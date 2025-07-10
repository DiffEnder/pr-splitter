import { generateText, tool } from 'ai'
import {
  LLMConfig,
  ModelTier,
  VectorHunkEntry,
  HunkGroup,
  FileStatistics,
  FileStatisticsAndTag,
  LlmUsageChange,
} from './types'
import { z } from 'zod'
import { EmbeddingService, searchHunksByText } from './embedding-service'
import keys from 'lodash/fp/keys.js'
import values from 'lodash/fp/values.js'
import isEmpty from 'lodash/fp/isEmpty.js'
import { v4 } from 'uuid'
import { createAIProvider, withRetry } from './utils'
import { map, sum } from 'ramda'

type PartialToolState = {
  embeddingService: EmbeddingService
  groups: Record<string, HunkGroup>
}

type ToolState = PartialToolState & {
  current: VectorHunkEntry | null
}

const createAddToGroupTool = (state: ToolState) => {
  return tool({
    description: 'Add current hunk to group',
    parameters: z.object({ groupId: z.string() }),
    execute: async ({ groupId }: { groupId: string }) => {
      if (!state.current) return 'No current hunk. Pop a hunk to set the current hunk.'
      state.groups[groupId].hunks.unshift(state.current)
      state.current = null
      return `Successfully added hunk to group ${groupId}`
    },
  })
}

const createMergeGroupsTool = (state: PartialToolState) =>
  tool({
    description: 'Merge two groups together',
    parameters: z.object({
      groupIdA: z.string(),
      groupIdB: z.string(),
      newDescription: z.string(),
    }),
    execute: async ({
      groupIdA,
      groupIdB,
      newDescription,
    }: {
      groupIdA: string
      groupIdB: string
      newDescription: string
    }) => {
      const groupA = state.groups[groupIdA]
      const groupB = state.groups[groupIdB]
      if (!groupA) return `Could not find group with ID ${groupIdA}`
      if (!groupB) return `Could not find group with ID ${groupIdB}`
      const newGroupId = v4()
      state.groups[newGroupId] = {
        description: newDescription,
        hunks: groupA.hunks.concat(groupB.hunks),
      }
      delete state.groups[groupIdA]
      delete state.groups[groupIdB]
      return `Groups merged into a new group with ID ${newGroupId}`
    },
  })

const createCreateGroupTool = (state: PartialToolState) =>
  tool({
    description: 'Create a new empty group of hunks with a description',
    parameters: z.object({ description: z.string() }),
    execute: async ({ description }: { description: string }) => {
      const id = v4()
      state.groups[id] = {
        description,
        hunks: [],
      }
      return `Created new group with id ${id}`
    },
  })

const createListGroupsTool = (state: PartialToolState) =>
  tool({
    description: 'List the groups',
    parameters: z.object({}),
    execute: async () => {
      if (isEmpty(state.groups)) return 'No groups yet.'
      return keys(state.groups)
        .map(
          (groupId) => `Group ID: ${groupId}\n Description: ${state.groups[groupId].description}`,
        )
        .join('\n\n')
    },
  })

const createSearchTool = (state: PartialToolState) =>
  tool({
    description:
      'Search all hunks that have been grouped for a given query using vector similarity',
    parameters: z.object({ query: z.string() }),
    execute: async ({ query }: { query: string }) => {
      const allGroupedHunks = values(state.groups).flatMap(({ hunks }) => hunks)
      const results = await searchHunksByText(
        query,
        allGroupedHunks,
        state.embeddingService,
        10,
        0.1,
      )
      const getGroupId = (hunkHash: string) => {
        for (const groupId of Object.keys(state.groups)) {
          let isHunkInGroup = state.groups[groupId].hunks.find(({ hash }) => hash === hunkHash)
          if (isHunkInGroup) return groupId
        }
        return null
      }
      return results.map(({ hunk, similarity }) => ({
        groupId: getGroupId(hunk.hash),
        filePath: hunk.filePath,
        summary: hunk.summary,
        similarity,
      }))
    },
  })

export const groupHunks = async ({
  config,
  hunks,
  embeddingService,
  userInstructions,
  addUsage,
  onHunkGrouped,
}: {
  config: LLMConfig
  hunks: VectorHunkEntry[]
  embeddingService: EmbeddingService
  userInstructions: string
  addUsage: (usage: LlmUsageChange) => void
  onHunkGrouped: () => void
}) => {
  const modelType: ModelTier = ModelTier.STANDARD
  const ungroupedHunks = [...hunks]
  const state: ToolState = { current: null, groups: {}, embeddingService }
  let totalUsage = { promptTokens: 0, completionTokens: 0 }

  const fullUserInstructions = userInstructions
    ? `\n\nThe pull request author has provided the following guidance for splitting the pull request: \"${userInstructions}\"`
    : ''

  while (ungroupedHunks.length > 0) {
    state.current = ungroupedHunks.shift() || null
    if (!state.current) break

    const prompt = `You are a senior software engineer tasked with separating diff hunks into groups. These groups of hunks will later be used to create a commit per group so it is paramount that the hunks that are dependent on one another are grouped together. 
    ${fullUserInstructions}
    Here are some general guidelines for grouping hunks:
      - If an auto-generated hunk is created by some other hunk, e.g. a yarn.lock file which is generated by a package.json file, then the yarn.lock file should be grouped with the package.json file.

Already some groups may have been created, so it is your job to determine if this hunk should be added to an existing group, or if a new group should be created. Follow these steps:
  1. Using the search tool, and list groups tool, do a thorough search to determine whether this hunk belongs in an existing group or in a new group. You can do multiple searches with different queries to find the best group. Each hunk has been indexed for search using the hunk's summary, so use symbols referenced in the current hunk's summary for the best search terms.
  2. If a suitable group is found, add the hunk to the group.
  3. If no suitable group is found, create a new group and add the hunk to it.

  **DO NOT** stop until the hunk is added to a group.

  Current hunk:
  ${JSON.stringify(
    {
      summary: state.current.summary,
      filePath: state.current.filePath,
      content: state.current.content,
    },
    null,
    2,
  )}
  `

    const generateTextConfig = {
      model: createAIProvider(config, modelType),
      prompt,
      maxRetries: 10,
      maxSteps: 1000,
      tools: {
        addToGroup: createAddToGroupTool(state),
        mergeGroups: createMergeGroupsTool(state),
        createGroup: createCreateGroupTool(state),
        listGroups: createListGroupsTool(state),
        search: createSearchTool(state),
      },
    }

    const { usage } = await generateText(generateTextConfig)

    totalUsage = {
      promptTokens: totalUsage.promptTokens + usage.promptTokens,
      completionTokens: totalUsage.completionTokens + usage.completionTokens,
    }

    // The hunk was not added to a group
    if (state.current) throw new Error(`Hunk was not added to a group: ${state.current.summary}`)

    onHunkGrouped()
  }

  addUsage({ standard: totalUsage })
  return state.groups
}

export const refineGroups = async ({
  groups,
  embeddingService,
  llmConfig,
  addUsage,
}: {
  groups: Record<string, HunkGroup>
  embeddingService: EmbeddingService
  llmConfig: LLMConfig
  addUsage: (usage: LlmUsageChange) => void
}) => {
  const model = createAIProvider(llmConfig, ModelTier.PREMIUM)

  const state: PartialToolState = { embeddingService, groups }

  const groupsAsText = keys(groups)
    .map((groupId) => ({
      groupId,
      description: groups[groupId].description,
      hunks: groups[groupId].hunks.map((hunk) => ({
        summary: hunk.summary,
        filePath: hunk.filePath,
        content: hunk.content,
        linesAdded: hunk.linesAdded,
        linesRemoved: hunk.linesRemoved,
      })),
    }))
    .map((group) => {
      const linesAdded = sum(map((hunk) => hunk.linesAdded, group.hunks))
      const linesRemoved = sum(map((hunk) => hunk.linesRemoved, group.hunks))
      return `Group ID: ${group.groupId}\n Description: ${
        group.description
      }\n Lines Added: ${linesAdded}\n Lines Removed: ${linesRemoved}\n Hunks: ${group.hunks
        .map(
          (hunk) =>
            `\t - File Path: ${hunk.filePath}\n\t\t Summary: ${hunk.summary}\n\t\t Content: ${hunk.content}`,
        )
        .join('\n')}\n\n`
    })
    .join('\n\n')

  const prompt = `You are an expert code reviewer and analyst in the middle of breaking up a pull request into a series of commits to review and merge separately. At the moment, you have a set of groups of hunks that have been created. Your task is to refine these groups
  to ensure that we have not gone too far in the process of breaking up the pull request, that the groups are not too small, and that hunks that are dependent and tightly related to each other are grouped together.
  
  Though you are also not allowed to overzealously group hunks together. We do not want groups to be too too big because the ultimate goal is to create groups that are easy to code review independently. 

  Here are some general guidelines for refining groups:
    - If a group lays the groundwork for another group, e.g. a group that adds a new function that is used by another group, then prefer to keep the two groups separate if it prevents the groups from being too large. Of course, if this would not make the review too cumbersome, then you can merge the two groups.
    - Aim for group sizes between 10 - 200 lines added/removed.

  **DO NOT** stop until the groups have been refined.

  Groups:
  ${groupsAsText}
  `

  const { text, usage } = await withRetry(() =>
    generateText({
      model: model,
      prompt: prompt,
      maxRetries: 10,
      maxSteps: 1000,
      tools: {
        mergeGroups: createMergeGroupsTool(state),
        listGroups: createListGroupsTool(state),
        search: createSearchTool(state),
      },
    }),
  )
  addUsage({ premium: usage })
  return state.groups
}

export const summarizeDiff = async ({
  diff,
  filePath,
  llmConfig,
  addUsage,
}: {
  diff: string
  filePath: string
  llmConfig: LLMConfig
  addUsage: (usage: LlmUsageChange) => void
}) => {
  const model = createAIProvider(llmConfig, ModelTier.STANDARD)

  const prompt = `You are an expert code reviewer and analyst. Your goal is to create a list of top level constructs that have been modified in this hunk (so as to understand how this hunk affects the rest of the codebase and file), and a list of symbols that have been newly used, usage has changed, or usage removed so as to understand how this hunks dependencies have changed.

  **ONLY** include the list of exports and imports in your response.
  **DO NOT** include any other text in your response.

  File: ${filePath}

Hunk:
${diff}

Provide the summary as a list of search terms that will be vectorized and used to search for similar hunks.

Summary:`

  const { text, usage } = await withRetry(
    () =>
      generateText({
        model: model,
        prompt: prompt,
        temperature: 0,
        maxTokens: 60,
        maxRetries: 10,
      }),
    undefined,
    `hunk summary for ${filePath}`,
  )

  addUsage({ standard: usage })
  return text.trim()
}

export const tagFileStatistics = async ({
  fileStatistics,
  llmConfig,
  addUsage,
}: {
  fileStatistics: FileStatistics[]
  llmConfig: LLMConfig
  addUsage: (usage: LlmUsageChange) => void
}) => {
  const model = createAIProvider(llmConfig, ModelTier.STANDARD)
  const result: FileStatisticsAndTag[] = []

  // Process files in batches of 5
  const batchSize = 5
  for (let i = 0; i < fileStatistics.length; i += batchSize) {
    const batch = fileStatistics.slice(i, i + batchSize)

    const batchPromises = batch.map(async (fileStats) => {
      const prompt = `You are an expert code reviewer and analyst. Your goal is to determine whether this file diff contains human readable content.
      Examples of non-human readable files:
      - Binary files
      - SVG files
      - Generated files like \`package-lock.json\`, \`yarn.lock\`, \`pnpm-lock.yaml\`, \`bun.lockb\` - \`Cargo.lock\` - \`Pipfile.lock\`, \`poetry.lock\` - \`go.sum\` - \`Gemfile.lock\` - \`composer.lock\` - \`Package.resolved\`
      Examples of human readable files:
      - Code files
      - Config files
      - Markdown files

      The name of the file is ${fileStats.filePath}. There are ${fileStats.linesAdded} line(s) added and ${fileStats.linesRemoved} line(s) removed.

      **DO NOT** under **any circumstances** stop until the file has been categorized by either calling \`setIsHumanReadable(true)\` or \`setIsHumanReadable(false)\`.
      `

      let hasBeenTagged = false
      let taggedFile: FileStatisticsAndTag | null = null

      const { usage } = await withRetry(
        () =>
          generateText({
            model: model,
            prompt: prompt,
            maxRetries: 10,
            maxSteps: 100,
            tools: {
              setIsHumanReadable: tool({
                description: 'Categorize the file as human readable or not',
                parameters: z.object({ humanReadable: z.boolean() }),
                execute: async ({ humanReadable }: { humanReadable: boolean }) => {
                  taggedFile = {
                    ...fileStats,
                    tag: humanReadable ? 'summarizable' : 'opaque',
                  }
                  hasBeenTagged = true
                  return `File ${fileStats.filePath} tagged as ${
                    humanReadable ? 'summarizable' : 'opaque'
                  }`
                },
              }),
            },
          }),
        undefined,
        `tagging file statistics for ${fileStats.filePath}`,
      )
      addUsage({ standard: usage })

      if (!hasBeenTagged || !taggedFile)
        throw new Error(`File ${fileStats.filePath} was not tagged`)

      return taggedFile
    })

    const batchResults = await Promise.all(batchPromises)
    result.push(...batchResults)
  }

  return result
}

export const getIsLlmApiKeyValid = async (llmConfig: LLMConfig) => {
  const model = createAIProvider(llmConfig, ModelTier.STANDARD)
  try {
    await generateText({
      model: model,
      prompt: 'Hello, world!',
      maxRetries: 0,
      maxSteps: 1,
    })
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}
