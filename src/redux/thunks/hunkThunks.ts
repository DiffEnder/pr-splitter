import {
  VectorHunkEntry,
  LLMConfig,
  ParsedHunk,
  TextHunk,
  BinaryHunk,
  UnrecognizedHunk,
  HunkType,
  VectorHunkEntryWithoutId,
  LlmUsageChange,
} from '../../types'
import { EmbeddingService } from '../../embedding-service'
import { summarizeDiff, tagFileStatistics } from '../../ai'
import { partition } from 'ramda'
import { createAsyncThunk } from '@reduxjs/toolkit'
import { State, usageIncreased } from '../slice'
import { AppDispatch } from '../store'
import { addHash, calculateFileStatistics, combineHunks } from './hunkThunksHelpers'

export const hunksToVectorEntries = createAsyncThunk<
  VectorHunkEntry[],
  {
    hunks: ParsedHunk[]
    embeddingService: EmbeddingService
    llmConfig: LLMConfig
  },
  {
    dispatch: AppDispatch
    state: State
  }
>(
  'ai/hunksToVectorEntries',
  async (
    { hunks, embeddingService, llmConfig },
    { dispatch, getState },
  ): Promise<VectorHunkEntry[]> => {
    const binaryHunks = hunks.filter((hunk) => hunk.type === 'binary')
    const textHunks = hunks.filter((hunk) => hunk.type === 'text')
    const unrecognizedHunks = hunks.filter((hunk) => hunk.type === 'unrecognized')
    const addUsage = (usage: LlmUsageChange) => {
      dispatch(usageIncreased({ usage }))
    }
    const binaryEntries = await binaryHunksToVectorEntries({
      hunks: binaryHunks,
      embeddingService,
    })
    const unrecognizedEntries = await dispatch(
      unrecognizedHunksToVectorEntries({
        hunks: unrecognizedHunks,
        embeddingService,
        llmConfig,
      }),
    ).unwrap()

    const fileStatistics = calculateFileStatistics(textHunks)
    const taggedFiles = await tagFileStatistics({
      fileStatistics,
      llmConfig,
      addUsage,
    })
    const [opaqueFiles, summarizableFiles] = partition((file) => file.tag === 'opaque', taggedFiles)
    const opaqueHunks = opaqueFiles.map((file) => combineHunks(file.hunks))
    const opaqueEntries = await opaqueTextHunksToVectorEntries({
      hunks: opaqueHunks,
      embeddingService,
    })
    const textEntries = await dispatch(
      textHunksToVectorEntries({
        hunks: summarizableFiles.flatMap((file) => file.hunks),
        embeddingService,
        llmConfig,
      }),
    ).unwrap()

    return [...binaryEntries, ...unrecognizedEntries, ...opaqueEntries, ...textEntries].map(addHash)
  },
)

const binaryHunksToVectorEntries = async ({
  hunks,
  embeddingService,
}: {
  hunks: BinaryHunk[]
  embeddingService: EmbeddingService
}): Promise<VectorHunkEntryWithoutId[]> =>
  Promise.all(
    hunks.map(async (hunk) => {
      const summary = `${hunk.operation} ${hunk.filePath}`
      return {
        type: HunkType.BINARY,
        filePath: hunk.filePath,
        previousFilePath: hunk.previousFilePath,
        content: '[Binary hunk content]',
        summary,
        embedding: await embeddingService.embedHunk(summary),
        completePatch: hunk.completePatch,
        linesAdded: 0,
        linesRemoved: 0,
      }
    }),
  )

const unrecognizedHunksToVectorEntries = createAsyncThunk<
  VectorHunkEntryWithoutId[],
  {
    hunks: UnrecognizedHunk[]
    embeddingService: EmbeddingService
    llmConfig: LLMConfig
  },
  {
    dispatch: AppDispatch
    state: State
  }
>(
  'ai/unrecognizedHunksToVectorEntries',
  async ({ hunks, embeddingService, llmConfig }, { dispatch }) => {
    const batchSize = 5
    const entries: VectorHunkEntryWithoutId[] = []

    const addUsage = (usage: LlmUsageChange) => {
      dispatch(usageIncreased({ usage }))
    }

    for (let i = 0; i < hunks.length; i += batchSize) {
      const batch = hunks.slice(i, i + batchSize)

      const batchEntries = await Promise.all(
        batch.map(async (hunk) => {
          const diffSubstring = hunk.completePatch.slice(0, 1000)
          const numLinesHidden =
            hunk.completePatch.split('\n').length - diffSubstring.split('\n').length

          const summary = await summarizeDiff({
            diff: diffSubstring,
            filePath: hunk.filePath,
            llmConfig,
            addUsage,
          })
          const embedding = await embeddingService.embedHunk(summary)

          return {
            type: HunkType.UNRECOGNIZED,
            filePath: hunk.filePath,
            previousFilePath: hunk.previousFilePath,
            content: `${diffSubstring}\n[${numLinesHidden} lines hidden]`,
            summary: summary,
            embedding: embedding,
            completePatch: hunk.completePatch,
            linesAdded: 0,
            linesRemoved: 0,
          }
        }),
      )

      entries.push(...batchEntries)
    }

    return entries
  },
)

const textHunksToVectorEntries = createAsyncThunk<
  VectorHunkEntryWithoutId[],
  {
    hunks: TextHunk[]
    embeddingService: EmbeddingService
    llmConfig: LLMConfig
  },
  {
    dispatch: AppDispatch
  }
>('ai/textHunksToVectorEntries', async ({ hunks, embeddingService, llmConfig }, { dispatch }) => {
  const addUsage = (usage: LlmUsageChange) => {
    dispatch(usageIncreased({ usage }))
  }
  const batchSize = 5
  const entries: VectorHunkEntryWithoutId[] = []

  for (let i = 0; i < hunks.length; i += batchSize) {
    const batch = hunks.slice(i, i + batchSize)

    const batchEntries = await Promise.all(
      batch.map(async (hunk) => {
        // ASSUMPTION: We're going to embed only the summary.
        // There's a chance this will miss out on some context, but it's a tradeoff.
        // Worth a test in the future to add the content of the hunk to the embedding.

        const summary = await summarizeDiff({
          diff: hunk.content,
          filePath: hunk.filePath,
          llmConfig,
          addUsage,
        })
        const embedding = await embeddingService.embedHunk(summary)

        return {
          type: HunkType.TEXT,
          filePath: hunk.filePath,
          previousFilePath: hunk.previousFilePath,
          content: hunk.content,
          summary: summary,
          embedding: embedding,
          completePatch: hunk.completePatch,
          linesAdded: hunk.linesAdded,
          linesRemoved: hunk.linesRemoved,
        }
      }),
    )

    entries.push(...batchEntries)
  }

  return entries
})

const opaqueTextHunksToVectorEntries = async ({
  hunks,
  embeddingService,
}: {
  hunks: TextHunk[]
  embeddingService: EmbeddingService
}): Promise<VectorHunkEntryWithoutId[]> => {
  const entries: VectorHunkEntryWithoutId[] = []
  for (const hunk of hunks) {
    const summary = `${hunk.operation} ${hunk.filePath}`
    const fileName = hunk.filePath.split('/').pop()
    const embedding = await embeddingService.embedHunk(summary)
    entries.push({
      type: HunkType.TEXT,
      filePath: hunk.filePath,
      content: `[Removed ${hunk.linesRemoved} lines, added ${hunk.linesAdded} lines, in ${fileName}]`,
      summary: summary,
      embedding: embedding,
      completePatch: hunk.completePatch,
      linesAdded: hunk.linesAdded,
      linesRemoved: hunk.linesRemoved,
    })
  }
  return entries
}
