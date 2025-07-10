import { createAsyncThunk } from '@reduxjs/toolkit'
import { commitGroups, setupRepository } from '../../git-operations'
import { enhancePullRequestInfo, getIsTokenValid } from '../../github-api'
import { parsePullRequestUrl } from '../../url-parser'
import {
  configSet,
  secretConfigRequested,
  secretConfigSet,
  pullRequestUrlRequested,
  repoConfigRequested,
  State,
  stepChanged,
  startedCloningRepo,
  finishedCloningRepo,
  parsedDiff,
  startedCreatingEmbeddings,
  startedGroupingHunks,
  finishedGroupingHunks,
  startedRefiningGroups,
  finishedRefiningGroups,
  startedSplittingPullRequest,
  usageIncreased,
  prCreationStatusChanged,
  hunkGrouped,
  finishedSplit,
  movedToPullRequestCreation,
} from '../slice'
import {
  ensureConfigFile,
  getConfig,
  getRepoConfig,
  getSecretConfig,
  setConfig,
  setSecretConfig,
  getRepoIdentifier,
} from '../../config'
import { EmbeddingService } from '../../embedding-service'
import { getIsLlmApiKeyValid, groupHunks, refineGroups } from '../../ai'
import values from 'lodash/fp/values.js'
import isEmpty from 'lodash/fp/isEmpty.js'
import {
  CommitedHunkGroup,
  Config,
  GitHubPullRequestCreateResponse,
  HunkGroup,
  LLMConfig,
  LLMProvider,
  SecretConfig,
} from '../../types'
import { AppDispatch } from '../store'
import { hunksToVectorEntries } from './hunkThunks'
import { parseDiff } from './hunkThunksHelpers'
import { selectGit, selectGithubToken, selectPrCreationData } from '../selectors'
import { Octokit } from '@octokit/rest'

export const init = createAsyncThunk<
  { config: Config; secretConfig: SecretConfig | null },
  void,
  { dispatch: AppDispatch }
>('app/init', async (_, { dispatch }) => {
  await ensureConfigFile()
  const [secretConfig, config] = await Promise.all([getSecretConfig(), getConfig()])

  if (!config) {
    throw new Error('Could not find config immediately after ensuring config file exists.')
  }

  dispatch(configSet({ config }))

  if (!secretConfig) {
    dispatch(secretConfigRequested())
    return { config, secretConfig: null }
  }

  dispatch(secretConfigSet({ secretConfig }))
  dispatch(stepChanged({ step: 'MENU' }))
  return { config, secretConfig }
})

export const splitPullRequest = createAsyncThunk<
  void,
  { prUrl: string },
  { dispatch: AppDispatch; state: State }
>('app/splitPullRequest', async ({ prUrl }: { prUrl: string }, { dispatch, getState }) => {
  dispatch(startedSplittingPullRequest())
  const { secretConfig } = getState()
  if (!secretConfig) throw new Error('Secret config is required')

  const { githubToken } = secretConfig
  const isTokenValid = await getIsTokenValid(githubToken)

  if (!isTokenValid) {
    dispatch(stepChanged({ step: 'SETTING_GITHUB_TOKEN' }))
    return
  }

  const isLlmApiKeyValid = await getIsLlmApiKeyValid(secretConfig.llmConfig)

  if (!isLlmApiKeyValid) {
    dispatch(stepChanged({ step: 'SETTING_LLM_API_KEY' }))
    return
  }

  const prInfo = parsePullRequestUrl(prUrl, githubToken)
  const repoConfig = await getRepoConfig({ owner: prInfo.owner, repo: prInfo.repo })

  if (!repoConfig) {
    dispatch(repoConfigRequested())
    return
  }

  dispatch(startedCloningRepo({ prInfo }))
  const enhancedPrInfo = await enhancePullRequestInfo({ prInfo, githubToken })
  const { git, tempDir } = await setupRepository(enhancedPrInfo)
  dispatch(finishedCloningRepo({ localPath: tempDir }))

  dispatch(startedCreatingEmbeddings())

  const diffOutput = await git.raw([
    'diff',
    '--binary',
    `${enhancedPrInfo.baseSha}..${enhancedPrInfo.headSha}`,
  ])
  const hunks = parseDiff(diffOutput)
  dispatch(parsedDiff({ hunks, enhancedPrInfo }))

  const embeddingService = new EmbeddingService()
  await embeddingService.initialize()
  dispatch(startedCreatingEmbeddings())
  const vectorEntries = await dispatch(
    hunksToVectorEntries({ hunks, embeddingService, llmConfig: secretConfig.llmConfig }),
  ).unwrap()

  dispatch(startedGroupingHunks())

  const groups = await groupHunks({
    config: secretConfig.llmConfig,
    hunks: vectorEntries,
    userInstructions: '',
    embeddingService,
    addUsage: (usage) => {
      dispatch(usageIncreased({ usage }))
    },
    onHunkGrouped: () => dispatch(hunkGrouped()),
  })

  dispatch(finishedGroupingHunks({ groups: values(groups) }))

  await new Promise((resolve) => setTimeout(resolve, 1000))

  dispatch(startedRefiningGroups())
  const refinedGroups = await refineGroups({
    groups,
    embeddingService,
    llmConfig: secretConfig.llmConfig,
    addUsage: (usage) => {
      dispatch(usageIncreased({ usage }))
    },
  })

  dispatch(finishedRefiningGroups({ groups: values(refinedGroups) }))

  dispatch(finishedSplit())

  await new Promise((resolve) => setTimeout(resolve, 2000))

  dispatch(movedToPullRequestCreation())
})

export const createCommits = createAsyncThunk<
  { commitedGroups: CommitedHunkGroup[] },
  void,
  { dispatch: AppDispatch; state: State }
>('app/createCommits', async (_, { dispatch, getState }) => {
  const state = getState()
  const git = selectGit(state)
  const groups = state.refinedHunksGroups
  const enhancedPrInfo = state.enhancedPrInfo
  if (!git) throw new Error('Cound not find git instance while committing pull request groups')
  if (!groups) throw new Error('Cound not find groups to commit')
  if (!enhancedPrInfo)
    throw new Error(
      'Cound not find the git sha of the base branch of the pull request while commiting groups',
    )
  const commitedGroups = await commitGroups({ git, enhancedPrInfo, groups })
  return { commitedGroups }
})

export const pushCommitedGroupBranches = createAsyncThunk<
  void,
  void,
  { dispatch: AppDispatch; state: State }
>('app/pushBranches', async (_, { getState }) => {
  const state = getState()
  const commitedGroups = state.commitedHunkGroups
  const git = selectGit(state)
  if (!commitedGroups) throw new Error('Cound not find commited groups to push')
  if (!git) throw new Error('Cound not find git instance to push branches')
  for (const commitedGroup of commitedGroups) {
    await git.push('origin', commitedGroup.branchName, { '--force': null, '--set-upstream': null })
  }
})

export const createPullRequests = createAsyncThunk<
  { pullRequests: GitHubPullRequestCreateResponse[] },
  void,
  { dispatch: AppDispatch; state: State }
>('app/createPullRequests', async (_, { dispatch, getState }) => {
  const state = getState()
  const githubToken = selectGithubToken(state)
  if (!githubToken) throw new Error('GitHub token is required to create pull requests')
  await dispatch(createCommits()).unwrap()
  await dispatch(pushCommitedGroupBranches()).unwrap()
  const prCreationData = selectPrCreationData(getState())
  if (isEmpty(prCreationData)) throw new Error('No pull request creation data found')
  const octokit = new Octokit({ auth: githubToken })
  const pullRequests = await Promise.all(
    prCreationData.map(async (prData) => octokit.rest.pulls.create({ ...prData })),
  )
  return { pullRequests }
})

export const closeOriginalPullRequest = createAsyncThunk<
  void,
  void,
  { dispatch: AppDispatch; state: State }
>('app/closeOriginalPullRequest', async (_, { dispatch, getState }) => {
  const state = getState()
  const githubToken = selectGithubToken(state)
  const pullRequests = state.pullRequests
  if (!pullRequests) throw new Error('Pull requests are required to close original pull request')
  if (!githubToken) throw new Error('GitHub token is required to close original pull request')
  const prInfo = state.prInfo
  if (!prInfo) throw new Error('Pull request info is required to close original pull request')

  const newBody = `This pull request has been split into ${
    pullRequests.length
  } smaller pull requests. The original pull request has been closed.\n\n${pullRequests
    .map((pr) => `- ${pr.data.html_url}`)
    .join('\n')}`
  const octokit = new Octokit({ auth: githubToken })
  await octokit.rest.pulls.update({
    owner: prInfo.owner,
    repo: prInfo.repo,
    body: newBody,
    pull_number: parseInt(prInfo.prNumber),
    state: 'closed',
  })
  setTimeout(() => {
    dispatch(prCreationStatusChanged({ status: 'FINISHED' }))
  }, 2000)
})

export const setTestCommandForRepo = createAsyncThunk<
  Config,
  { testCommand: string },
  { dispatch: AppDispatch; state: State }
>(
  'app/setTestCommandForRepo',
  async ({ testCommand }: { testCommand: string }, { dispatch, getState }) => {
    const state = getState()

    const { config, prUrl } = state
    if (!config) throw new Error('Config is required')
    if (!prUrl) throw new Error('Pull request URL is required')

    const { owner, repo } = parsePullRequestUrl(prUrl)

    const updatedConfig = {
      ...config,
      repoConfigs: {
        ...config.repoConfigs,
        [getRepoIdentifier({ owner, repo })]: { testCommand },
      },
    }

    await setConfig(updatedConfig)

    dispatch(configSet({ config: updatedConfig }))
    dispatch(pullRequestUrlRequested())

    return updatedConfig
  },
)

export const updateSecretConfig = createAsyncThunk<
  SecretConfig,
  {
    githubToken?: string
    provider?: LLMProvider
    apiKey?: string
    endpoint?: string
    clearEndpoint?: boolean
  },
  { dispatch: AppDispatch }
>(
  'app/updateSecretConfig',
  async ({ githubToken, provider, apiKey, endpoint, clearEndpoint = false }, { dispatch }) => {
    const secretConfig = await getSecretConfig()
    const newGithubToken = githubToken ?? secretConfig?.githubToken
    const newLlmProvider = provider ?? secretConfig?.llmConfig.provider
    const newLlmApiKey = apiKey ?? secretConfig?.llmConfig.apiKey
    const newLlmEndpoint = clearEndpoint ? undefined : endpoint ?? secretConfig?.llmConfig.endpoint
    if (!newGithubToken)
      throw new Error('The GitHub token is required when creating a secret config')
    if (!newLlmProvider)
      throw new Error('The LLM provider is required when creating a secret config')
    if (!newLlmApiKey) throw new Error('The LLM API key is required when creating a secret config')

    const newLlmConfig: LLMConfig = {
      provider: newLlmProvider,
      apiKey: newLlmApiKey,
      endpoint: newLlmEndpoint,
    }
    const updatedSecretConfig: SecretConfig = {
      githubToken: newGithubToken,
      llmConfig: newLlmConfig,
    }

    await setSecretConfig(updatedSecretConfig)

    dispatch(secretConfigSet({ secretConfig: updatedSecretConfig }))

    return updatedSecretConfig
  },
)
