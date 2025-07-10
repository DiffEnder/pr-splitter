import {
  VectorHunkEntry,
  ParsedHunk,
  TextHunk,
  FileStatistics,
  HunkType,
  VectorHunkEntryWithoutId,
} from '../../types'
import { groupBy, map, sortBy, sum } from 'ramda'
import { createHash } from 'crypto'

export const getOperationType = (
  rawPatch: string,
): 'added' | 'deleted' | 'modified' | 'renamed' => {
  // Get the first 4 lines of the patch
  const firstFourLines = rawPatch.split('\n').slice(0, 4).join('\n')
  if (firstFourLines.includes('new file mode')) return 'added'
  if (firstFourLines.includes('deleted file mode')) return 'deleted'
  if (firstFourLines.includes('rename from') && firstFourLines.includes('rename to'))
    return 'renamed'
  const { originalFilePath, modifiedFilePath } = getPatchFile(rawPatch)
  if (originalFilePath.includes('/dev/null')) return 'added'
  if (modifiedFilePath.includes('/dev/null')) return 'deleted'
  if (originalFilePath === modifiedFilePath) return 'modified'
  return 'renamed'
}

const getFilePathAndPreviousFilePath = (
  rawPatch: string,
): { filePath: string; previousFilePath?: string } => {
  const { originalFilePath, modifiedFilePath } = getPatchFile(rawPatch)
  const operation = getOperationType(rawPatch)
  if (operation === 'added') return { filePath: modifiedFilePath, previousFilePath: undefined }
  if (operation === 'deleted') return { filePath: originalFilePath, previousFilePath: undefined }
  if (operation === 'renamed')
    return { filePath: modifiedFilePath, previousFilePath: originalFilePath }
  if (operation === 'modified') return { filePath: modifiedFilePath, previousFilePath: undefined }
  throw new Error(`Invalid operation: ${operation}`)
}

export const parseDiff = (diffOutput: string): ParsedHunk[] => {
  const lines = diffOutput.split('\n')
  // The rawest form of the patch with minimal processing so that we can fall back to
  // this if we can't parse the patch.
  const rawPatches: Array<string> = []
  const linesInPatchBuffer: Array<string> = []

  if (!diffOutput.startsWith('diff --git ')) throw new Error(`Invalid diff output: ${diffOutput}`)

  lines.forEach((line) => {
    if (line.startsWith('diff --git ')) {
      // Flush the buffer
      if (linesInPatchBuffer.length > 0) rawPatches.push(linesInPatchBuffer.join('\n'))
      linesInPatchBuffer.length = 0
      // Start a new patch
    }
    linesInPatchBuffer.push(line)
  })
  if (linesInPatchBuffer.length > 0) rawPatches.push(linesInPatchBuffer.join('\n'))

  return rawPatches.flatMap(parseRawPatch)
}

const getPatchType = (rawPatch: string): HunkType => {
  if (rawPatch.includes('GIT binary patch')) return HunkType.BINARY
  if (rawPatch.includes('@@')) return HunkType.TEXT
  return HunkType.UNRECOGNIZED
}

const getPatchFile = (rawPatch: string): { originalFilePath: string; modifiedFilePath: string } => {
  const match = rawPatch.match(/diff --git a\/(.+) b\/(.+)/)
  if (!match) throw new Error(`Invalid patch: ${rawPatch}`)
  return { originalFilePath: match[1], modifiedFilePath: match[2] }
}

const parseRawPatch = (rawPatch: string): ParsedHunk[] => {
  // The raw patches should all start with a diff --git line.
  if (!rawPatch.startsWith('diff --git ')) throw new Error(`Invalid patch: ${rawPatch}`)

  // Regardless of the patch type, we can get the file name
  const { filePath, previousFilePath } = getFilePathAndPreviousFilePath(rawPatch)
  const operation = getOperationType(rawPatch)
  const patchType = getPatchType(rawPatch)
  if (patchType === HunkType.UNRECOGNIZED || patchType === HunkType.BINARY) {
    return [
      {
        type: patchType,
        filePath,
        previousFilePath,
        completePatch: rawPatch,
        operation,
      },
    ]
  }

  if (patchType === 'text') return parseTextPatch(rawPatch)
  throw new Error(`Invalid patch: ${rawPatch}`)
}

function parseTextPatch(diffOutput: string): TextHunk[] {
  const hunks: TextHunk[] = []
  const lines = diffOutput.split('\n')
  const { filePath, previousFilePath } = getFilePathAndPreviousFilePath(diffOutput)

  const hunkHeader: string[] = []
  let encounteredFirstDiff = false
  let i = 0
  let hunkIndex = 0

  while (i < lines.length) {
    const line = lines[i]

    // We gather all of the lines before the first line diff.
    if (!encounteredFirstDiff && !line.startsWith('@@')) {
      hunkHeader.push(line)
      i++
      continue
    }

    // Check for hunk header: @@ -10,3 +10,4 @@ optional function context
    if (line.startsWith('@@')) {
      encounteredFirstDiff = true
      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/)
      if (!hunkMatch) throw new Error(`Invalid hunk header: ${line}`)
      const linesRemoved = parseInt(hunkMatch[2] || '1')
      const linesAdded = parseInt(hunkMatch[4] || '1')

      // Parse hunk content until next @@ or file header or end
      const hunkLines: string[] = [line] // Include the @@ line
      i++

      while (i < lines.length) {
        const contentLine = lines[i]

        // Stop at next hunk header or file header
        if (contentLine.startsWith('@@') || contentLine.startsWith('diff --git')) break

        hunkLines.push(contentLine)
        i++
      }

      // Build complete patch for this individual hunk
      const completePatchLines = [...hunkHeader, ...hunkLines]

      // Ensure patch ends with a newline (some git versions require this)
      const completePatch = completePatchLines.join('\n') + '\n'
      const operation = getOperationType(completePatch)

      const newHunk: TextHunk = {
        type: HunkType.TEXT,
        filePath,
        previousFilePath,
        header: hunkHeader.join('\n'),
        linesRemoved,
        linesAdded,
        content: hunkLines.join('\n'),
        completePatch,
        operation,
        index: hunkIndex,
      }

      hunks.push(newHunk)
      hunkIndex++
      // Don't increment i here since we want to process the line that broke the loop
      continue
    }

    i++
  }

  return hunks
}

export const addHash = (entry: VectorHunkEntryWithoutId): VectorHunkEntry => {
  const hash = createHash('sha256')
    .update(entry.completePatch + entry.filePath)
    .digest('hex')
    .slice(0, 8)
  return { ...entry, hash }
}

export const combineHunks = (hunks: TextHunk[]): TextHunk => {
  const sortedHunks = sortBy((hunk) => hunk.index, hunks)
  const allHunkContent = sortedHunks.map((hunk) => hunk.content).join('\n')
  const totalLinesAdded = sum(map((hunk) => hunk.linesAdded, sortedHunks))
  const totalLinesRemoved = sum(map((hunk) => hunk.linesRemoved, sortedHunks))
  const header = sortedHunks[0].header
  const operation = getOperationType(header + '\n' + allHunkContent)
  const combinedHunk: TextHunk = {
    filePath: hunks[0].filePath,
    previousFilePath: hunks[0].previousFilePath,
    type: HunkType.TEXT,
    linesRemoved: totalLinesRemoved,
    linesAdded: totalLinesAdded,
    content: allHunkContent,
    header,
    index: 0,
    completePatch: header + '\n' + allHunkContent + '\n',
    operation,
  }
  return combinedHunk
}

export const calculateFileStatistics = (hunks: TextHunk[]): Array<FileStatistics> => {
  const hunksByFile = groupBy((hunk) => hunk.filePath, hunks)
  const fileStatistics = Object.entries(hunksByFile).map(([filePath, hunks]) => {
    if (!hunks) return { filePath, linesAdded: 0, linesRemoved: 0, sample: '', hunks: [] }

    const linesAdded = sum(map((hunk) => hunk.linesAdded, hunks))
    const linesRemoved = sum(map((hunk) => hunk.linesRemoved, hunks))
    const sample = hunks[0].content
    return { filePath, linesAdded, linesRemoved, sample, hunks }
  })

  return fileStatistics
}
