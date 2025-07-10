import { readFileSync, writeFileSync } from 'fs'
import { EmbeddingService } from '../src/embedding-service'
import { VectorHunkEntry } from '../src/types'
import { parseDiff } from '../src/redux/thunks/hunkThunksHelpers'
import { getSecretConfig } from '../src/config'
import { configureStore } from '@reduxjs/toolkit'
import { reducer } from '../src/redux/slice'
import { hunksToVectorEntries } from '../src/redux/thunks/hunkThunks'

const writeHashes = (vectorEntries: VectorHunkEntry[], diffPath: string) => {
  // This function generates a new .ts file which just has lines like this
  // const HUNK_1 = `{
  // content: `
  // ${content}
  // `
  // hash: '${hash}'
  // }
  // ...
  // const HUNK_2 = {
  // content: `
  // ${content}
  // `
  // hash: '${hash}'
  // }
  // ...
  // export default {
  // groups: [
  // // Group your hunks here
  // // e.g.
  // // [HUNK_1.hash, HUNK_2.hash],
  // // [HUNK_3.hash, HUNK_4.hash],
  // ]
  // }
  const fileContent = vectorEntries
    .map((entry, index) => {
      return `const HUNK_${index + 1} = {
  content: \`${entry.content}\`,
  hash: '${entry.hash}'
};\n\n`
    })
    .join('')
  const finalContent = `
  // THIS FILE IS AUTO-GENERATED. DO NOT EDIT.

  ${fileContent}
  export default {
    groups: [
      // Group your hunks here
      // e.g.
      // [HUNK_1.hash, HUNK_2.hash],
      // [HUNK_3.hash, HUNK_4.hash],
    ]
  }
  `
  writeFileSync(diffPath, finalContent)
}

export const processDiffFile = async (diffPath: string) => {
  const diffOutput = readFileSync(diffPath, 'utf8')
  const secretConfig = await getSecretConfig()
  if (!secretConfig) {
    throw new Error('Secret config not found')
  }
  const hunks = parseDiff(diffOutput)
  const embeddingService = new EmbeddingService()
  await embeddingService.initialize()

  // Create a temporary store for the benchmark
  const store = configureStore({ reducer })

  // Dispatch the thunk and unwrap the result
  const vectorEntries = await store
    .dispatch(
      hunksToVectorEntries({
        hunks,
        embeddingService,
        llmConfig: secretConfig.llmConfig,
      }),
    )
    .unwrap()

  const goldFileName = diffPath.split('/').pop()?.split('.diff')[0] + '.ts'
  writeHashes(vectorEntries, `./benchmarks/gold/${goldFileName}`)
}

// Example usage
if (require.main === module) {
  const diffPath = process.argv[2]
  if (!diffPath) {
    console.error('Usage: ts-node generate-hashes.ts <path-to-diff-file>')
    process.exit(1)
  }
  processDiffFile(diffPath)
}
