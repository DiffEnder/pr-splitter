import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { groupHunks } from '../src/ai'
import { EmbeddingService } from '../src/embedding-service'
import { computeF1 } from './metrics'
import simpleGit from 'simple-git'
import { configureStore } from '@reduxjs/toolkit'
import { reducer, usageIncreased } from '../src/redux/slice'
import { hunksToVectorEntries } from '../src/redux/thunks/hunkThunks'
import { parseDiff } from '../src/redux/thunks/hunkThunksHelpers'
import { getSecretConfig } from '../src/config'

const SUMMARY_PATH = './benchmark_history/summary.json'
const INPUT_DIR = './benchmarks/input/'
const RUNS_DIR = './benchmark_history/runs/'

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = minutes.toString().padStart(hours > 0 ? 2 : 1, '0')
  const ss = seconds.toString().padStart(2, '0')
  return hours > 0 ? `${hours}h:${mm}m:${ss}s` : `${mm}m:${ss}s`
}

const getCurrentSha = async () => {
  // Ensure that there aren't any uncommitted changes using the simple git module
  const git = simpleGit()
  const status = await git.status()
  if (!status.isClean()) {
    throw new Error(
      'There are uncommitted changes. Please commit or stash your changes so that the benchmark results are reproducible.',
    )
  }
  const sha = (await git.revparse('HEAD')) as string
  return sha
}

const run = async () => {
  const sha = await getCurrentSha()
  // read the benchmarks/input directory
  const inputs = readdirSync(INPUT_DIR)
  const embeddingService = new EmbeddingService()
  await embeddingService.initialize()
  const secretConfig = await getSecretConfig()
  if (!secretConfig) {
    throw new Error('Secret config not found')
  }
  const llmConfig = secretConfig.llmConfig

  // Create a temporary store for the benchmark
  const store = configureStore({ reducer })

  const resultsByFile: Record<
    string,
    {
      f1Score: number
      timeMilliseconds: number
      timeHumanReadable: string
      numHunks: number
      sha: string
      groups: Array<Array<string>>
      llmProvider: string
    }
  > = {}
  for (const input of inputs) {
    const start = Date.now()
    const diffOutput = readFileSync(`${INPUT_DIR}${input}`, 'utf8')
    const hunks = parseDiff(diffOutput)
    const goldFileName = input.split('.diff')[0] + '.ts'
    // Generate vector entries with embeddings
    const vectorEntries = await store
      .dispatch(
        hunksToVectorEntries({
          hunks,
          embeddingService,
          llmConfig,
        }),
      )
      .unwrap()

    const groups = await groupHunks({
      config: llmConfig,
      hunks: vectorEntries,
      userInstructions: '',
      embeddingService,
      debug: false,
      addUsage: (usage) => {
        store.dispatch(usageIncreased({ usage }))
      },
    })

    const prediction = Object.values(groups).map((g) => g.hunks.map((h) => h.hash))
    // Import the gold file and access the GROUPS array
    const gold = (await import(`./gold/${goldFileName}`)).default as {
      groups: Array<Array<string>>
    }

    const f1Score = computeF1({ gold: gold.groups, prediction })
    const timeMilliseconds = Date.now() - start
    resultsByFile[input] = {
      f1Score,
      timeMilliseconds,
      timeHumanReadable: formatDuration(timeMilliseconds),
      numHunks: hunks.length,
      sha,
      groups: Object.values(groups).map((g) => g.hunks.map((h) => h.hash)),
      llmProvider: llmConfig.provider,
    }
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0]
  writeFileSync(`${RUNS_DIR}${timestamp}.json`, JSON.stringify(resultsByFile, null, 2))
  const summariesSoFar = JSON.parse(readFileSync(SUMMARY_PATH).toString())
  const worstToBest = Object.keys(resultsByFile)
    .map((file) => ({
      filePath: file,
      f1Score: resultsByFile[file].f1Score,
      timeMilliseconds: resultsByFile[file].timeMilliseconds,
      timeHumanReadable: resultsByFile[file].timeHumanReadable,
      numHunks: resultsByFile[file].numHunks,
    }))
    .sort((a, b) => (a.f1Score < b.f1Score ? -1 : 1))
  const f1Sum = worstToBest.map(({ f1Score }) => f1Score).reduce((sum, score) => sum + score, 0)
  const averageF1Score = f1Sum / worstToBest.length
  const totalHunks = worstToBest
    .map(({ numHunks }) => numHunks)
    .reduce((sum, numHunks) => sum + numHunks, 0)
  const averageTimePerHunk =
    worstToBest
      .map(({ timeMilliseconds }) => timeMilliseconds)
      .reduce((sum, timeMilliseconds) => sum + timeMilliseconds, 0) / totalHunks
  const newSummaryEntry = {
    date: new Date().toString(),
    worst: worstToBest[0],
    best: worstToBest[worstToBest.length - 1],
    averageF1Score,
    averageTimePerHunk: formatDuration(averageTimePerHunk),
    sha,
    llmProvider: llmConfig.provider,
  }
  writeFileSync(SUMMARY_PATH, JSON.stringify([...summariesSoFar, newSummaryEntry], null, 2))
  // Commit all of the changes marking the time
  const git = simpleGit()
  await git.add('.')
  await git.commit(`Benchmark results for ${llmConfig.provider}`)
}

run()
