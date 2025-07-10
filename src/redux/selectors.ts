import { createSelector } from 'reselect'
import { SplitStatus, State } from './slice'
import { getCostPer1M } from '../cost'
import { CommitedHunkGroup, HunkGroup, ModelTier, PrCreationData } from '../types'
import simpleGit from 'simple-git'
import isEmpty from 'lodash/fp/isEmpty.js'

const getSecretConfig = (state: State) => state.secretConfig
const getPage = (state: State) => state.page

export const selectLLMProvider = createSelector([getSecretConfig], (secretConfig) => {
  if (!secretConfig) return null
  return secretConfig.llmConfig.provider
})

export const selectLLMEndpoint = createSelector([getSecretConfig], (secretConfig) => {
  if (!secretConfig) return null
  return secretConfig.llmConfig.endpoint ?? null
})

export const selectLLMAPIKey = createSelector([getSecretConfig], (secretConfig) => {
  if (!secretConfig) return null
  return secretConfig.llmConfig.apiKey
})

export const selectGithubToken = createSelector([getSecretConfig], (secretConfig) => {
  if (!secretConfig) return null
  return secretConfig.githubToken
})

export const selectGit = createSelector([(state: State) => state.localPath], (localPath) => {
  if (!localPath) return null
  return simpleGit(localPath)
})

export const selectPrCreationData = createSelector(
  [(state) => state.commitedHunkGroups, (state) => state.enhancedPrInfo],
  (commitedHunkGroups, enhancedPrInfo) => {
    if (!commitedHunkGroups || !enhancedPrInfo) return []
    const result: PrCreationData[] = commitedHunkGroups.reduce(
      (acc: PrCreationData[], commitedHunkGroup: CommitedHunkGroup): PrCreationData[] => {
        return isEmpty(acc)
          ? [
              {
                owner: enhancedPrInfo.owner,
                repo: enhancedPrInfo.repo,
                title: `Pull request #${enhancedPrInfo.prNumber}: Split ${acc.length + 1}`,
                body: `### Description:\n\n${commitedHunkGroup.hunkGroup.description}\n\n[Link to original pull request](${enhancedPrInfo.link}).`,
                base: enhancedPrInfo.baseBranch,
                head: commitedHunkGroup.branchName,
              },
            ]
          : [
              ...acc,
              {
                owner: enhancedPrInfo.owner,
                repo: enhancedPrInfo.repo,
                title: `Pull request #${enhancedPrInfo.prNumber}: Split ${acc.length + 1}`,
                body: `### Description:\n\n${commitedHunkGroup.hunkGroup.description}\n\n[Link to original pull request](${enhancedPrInfo.link}).`,
                base: acc[acc.length - 1].head,
                head: commitedHunkGroup.branchName,
              },
            ]
      },
      [],
    )
    return result
  },
)

export const selectIsLoading = createSelector([getPage], (page) => page === 'LOADING')

export const selectTotalCost = createSelector(
  [(state: State) => state.usage, (state: State) => state.secretConfig],
  (usage, secretConfig) => {
    if (!secretConfig) return 0

    // Calculate cost for premium tier
    const premiumCosts = getCostPer1M({
      modelTier: ModelTier.PREMIUM,
      config: secretConfig.llmConfig,
    })
    const premiumPromptCost = (usage.premium.promptTokens / 1000000) * premiumCosts.prompt
    const premiumCompletionCost =
      (usage.premium.completionTokens / 1000000) * premiumCosts.completion

    // Calculate cost for standard tier
    const standardCosts = getCostPer1M({
      modelTier: ModelTier.STANDARD,
      config: secretConfig.llmConfig,
    })
    const standardPromptCost = (usage.standard.promptTokens / 1000000) * standardCosts.prompt
    const standardCompletionCost =
      (usage.standard.completionTokens / 1000000) * standardCosts.completion

    return premiumPromptCost + premiumCompletionCost + standardPromptCost + standardCompletionCost
  },
)

// We have a kind of complex way of calculating the progress bar.
// But this way we can add more steps, change the order, and not have
// any funky logic to make sure the returned value between 0 and 100
// is appropriate for the step.
const SPLIT_STATUS_ORDER: { status: SplitStatus; weight: number }[] = [
  { status: 'NOT_STARTED', weight: 0 },
  { status: 'STARTED', weight: 5 },
  { status: 'CLONING_REPO', weight: 10 },
  { status: 'CLONED_REPO', weight: 2 },
  { status: 'PARSED_DIFF', weight: 7 },
  { status: 'CREATING_EMBEDDINGS', weight: 15 },
  { status: 'GROUPING_HUNKS', weight: 30 },
  { status: 'GROUPED_HUNKS', weight: 5 },
  { status: 'REFINING_GROUPS', weight: 20 },
  { status: 'REFINED_GROUPS', weight: 4 },
  { status: 'SUCCEEDED', weight: 3 },
]

export const selectSplitProgress = createSelector(
  [
    (state: State) => state.splitStatus,
    (state: State) => state.numHunksGrouped,
    (state: State) => state.hunks,
  ],
  (splitStatus, numHunksGrouped, hunks) => {
    const totalWeight = SPLIT_STATUS_ORDER.reduce((acc, step) => acc + step.weight, 0)
    // We exclude the current step from the sum because it's not complete yet
    const currentWeight = SPLIT_STATUS_ORDER.slice(
      0,
      SPLIT_STATUS_ORDER.findIndex((step) => step.status === splitStatus),
    ).reduce((acc, step) => acc + step.weight, 0)

    const currentProgress = Math.round((currentWeight / totalWeight) * 100)
    // We want to have more granular progress bar for the grouping hunks step
    if (splitStatus === 'GROUPING_HUNKS') {
      if (!hunks) return currentProgress
      const weightOfGroupingHunksStep =
        SPLIT_STATUS_ORDER.find((step) => step.status === 'GROUPING_HUNKS')?.weight ?? 0
      const percentOfHunksGrouped = numHunksGrouped / hunks.length
      const extraWeightCompleted = weightOfGroupingHunksStep * percentOfHunksGrouped
      return currentProgress + (extraWeightCompleted / totalWeight) * 100
    }
    return currentProgress
  },
)

export const selectGroupOptions = createSelector(
  [(state: State) => state.refinedHunksGroups || []],
  (groups) => {
    const groupOptions: Array<{ label: string; value: string; group: HunkGroup | null }> =
      groups.map((group, index) => ({
        label: `PR #${index + 1}: ${group.description.slice(0, 75)}${
          group.description.length > 75 ? '...' : ''
        }`,
        value: `group_${index}`,
        group,
      }))
    return groupOptions
      .concat({
        label: '[Create PRs]',
        value: 'action_continue',
        group: null,
      })
      .concat({
        label: '[Cancel]',
        value: 'action_cancel',
        group: null,
      })
  },
)
