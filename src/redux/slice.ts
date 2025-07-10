import { createSlice, PayloadAction, SerializedError } from '@reduxjs/toolkit'
import {
  Config,
  HunkGroup,
  ParsedHunk,
  PullRequestInfo,
  SecretConfig,
  LlmUsageChange,
  LlmUsage,
  CommitedHunkGroup,
  GitHubPullRequestCreateResponse,
  EnhancedPullRequestInfo,
} from '../types'
import {
  closeOriginalPullRequest,
  createCommits,
  createPullRequests,
  init,
  pushCommitedGroupBranches,
  splitPullRequest,
} from './thunks/mainThunks'

export type Page =
  | 'LOADING'
  | 'WELCOME'
  | 'ADDING_SECRET_CONFIG'
  | 'SETTING_GITHUB_TOKEN'
  | 'ADDING_PULL_REQUEST_URL'
  | 'ADDING_REPO_TEST_COMMAND'
  | 'SPLITTING_PULL_REQUEST'
  | 'SETTING_LLM_API_KEY'
  | 'CREATING_PULL_REQUESTS'
  | 'MENU'

export type SplitStatus =
  | 'NOT_STARTED'
  | 'STARTED'
  | 'CLONING_REPO'
  | 'CLONED_REPO'
  | 'PARSED_DIFF'
  | 'CREATING_EMBEDDINGS'
  | 'GROUPING_HUNKS'
  | 'GROUPED_HUNKS'
  | 'REFINING_GROUPS'
  | 'REFINED_GROUPS'
  | 'SUCCEEDED'
  | 'FAILED'

export type PrCreationStatus =
  | 'NOT_STARTED'
  | 'ASKING_FOR_PERMISSION_TO_CREATE_PULL_REQUESTS'
  | 'COMMITTING_GROUPS'
  | 'COMMITTED_GROUPS'
  | 'PUSHING_BRANCHES'
  | 'PUSHED_BRANCHES'
  | 'CREATING_PULL_REQUESTS'
  | 'CREATED_PULL_REQUESTS'
  | 'ASKING_FOR_PERMISSION_TO_CLOSE_ORIGINAL_PULL_REQUEST'
  | 'CLOSING_ORIGINAL_PULL_REQUEST'
  | 'CLOSED_ORIGINAL_PULL_REQUEST'
  | 'FINISHED'
  | 'FAILED'

export type State = {
  page: Page
  config: Config | null
  secretConfig: SecretConfig | null
  prUrl: string | null
  prInfo: PullRequestInfo | null
  enhancedPrInfo: EnhancedPullRequestInfo | null
  hunks: ParsedHunk[] | null
  numHunksGrouped: number
  localPath: string | null
  initialHunksGroups: HunkGroup[] | null
  refinedHunksGroups: HunkGroup[] | null
  selectedHunkGroup: HunkGroup | null
  commitedHunkGroups: CommitedHunkGroup[] | null
  pullRequests: GitHubPullRequestCreateResponse[] | null
  splitStatus: SplitStatus
  prCreationStatus: PrCreationStatus
  error: SerializedError | null
  usage: LlmUsage
}

const initialState: State = {
  page: 'LOADING',
  config: null,
  secretConfig: null,
  prUrl: null,
  prInfo: null,
  enhancedPrInfo: null,
  hunks: null,
  numHunksGrouped: 0,
  localPath: null,
  initialHunksGroups: null,
  refinedHunksGroups: null,
  selectedHunkGroup: null,
  commitedHunkGroups: null,
  pullRequests: null,
  splitStatus: 'NOT_STARTED',
  prCreationStatus: 'NOT_STARTED',
  error: null,
  usage: {
    premium: {
      promptTokens: 0,
      completionTokens: 0,
    },
    standard: {
      promptTokens: 0,
      completionTokens: 0,
    },
  },
}

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    // This is just for debugging so that we can immediately get to a state
    // we want to test.
    setStore: (state, action: PayloadAction<State>) => {
      return action.payload
    },
    secretConfigRequested: (state) => {
      state.page = 'WELCOME'
    },
    secretConfigSet: (state, action: PayloadAction<{ secretConfig: SecretConfig }>) => {
      state.secretConfig = action.payload.secretConfig
    },
    pullRequestUrlRequested: (state) => {
      state.page = 'ADDING_PULL_REQUEST_URL'
    },
    repoConfigRequested: (state) => {
      state.page = 'ADDING_REPO_TEST_COMMAND'
    },
    configSet: (state, action: PayloadAction<{ config: Config }>) => {
      state.config = action.payload.config
    },
    startedSplittingPullRequest: (state) => {
      state.page = 'SPLITTING_PULL_REQUEST'
      state.splitStatus = 'STARTED'
      // Reset all of the pr splitting state prior to splitting
      // so that we start fresh, whether:
      //   - Its the first time they're splitting a pull request in this session
      //   - They successfully split one already, but wanted to do it again
      //   - They cancelled a split in this session
      state.prInfo = initialState.prInfo
      state.enhancedPrInfo = initialState.enhancedPrInfo
      state.hunks = initialState.hunks
      state.localPath = initialState.localPath
      state.initialHunksGroups = initialState.initialHunksGroups
      state.refinedHunksGroups = initialState.refinedHunksGroups
      state.commitedHunkGroups = initialState.commitedHunkGroups
      state.pullRequests = initialState.pullRequests
      state.prCreationStatus = initialState.prCreationStatus
      state.error = initialState.error
      state.numHunksGrouped = initialState.numHunksGrouped
    },
    startedCloningRepo: (state, action: PayloadAction<{ prInfo: PullRequestInfo }>) => {
      state.splitStatus = 'CLONING_REPO'
      state.prInfo = action.payload.prInfo
    },
    finishedCloningRepo: (state, action: PayloadAction<{ localPath: string }>) => {
      state.splitStatus = 'CLONED_REPO'
      state.localPath = action.payload.localPath
    },
    parsedDiff: (
      state,
      action: PayloadAction<{ hunks: ParsedHunk[]; enhancedPrInfo: EnhancedPullRequestInfo }>,
    ) => {
      state.splitStatus = 'PARSED_DIFF'
      state.hunks = action.payload.hunks
      state.enhancedPrInfo = action.payload.enhancedPrInfo
    },
    startedCreatingEmbeddings: (state) => {
      state.splitStatus = 'CREATING_EMBEDDINGS'
    },
    startedGroupingHunks: (state) => {
      state.splitStatus = 'GROUPING_HUNKS'
    },
    hunkGrouped: (state) => {
      state.numHunksGrouped++
    },
    finishedGroupingHunks: (state, action: PayloadAction<{ groups: HunkGroup[] }>) => {
      state.splitStatus = 'GROUPED_HUNKS'
      state.initialHunksGroups = action.payload.groups
    },
    startedRefiningGroups: (state) => {
      state.splitStatus = 'REFINING_GROUPS'
    },
    finishedRefiningGroups: (state, action: PayloadAction<{ groups: HunkGroup[] }>) => {
      state.splitStatus = 'REFINED_GROUPS'
      state.refinedHunksGroups = action.payload.groups
    },
    finishedSplit: (state) => {
      state.splitStatus = 'SUCCEEDED'
    },
    movedToPullRequestCreation: (state) => {
      state.page = 'CREATING_PULL_REQUESTS'
      state.prCreationStatus = 'ASKING_FOR_PERMISSION_TO_CREATE_PULL_REQUESTS'
    },
    stepChanged: (state, action: PayloadAction<{ step: Page }>) => {
      state.page = action.payload.step
    },
    usageIncreased: (
      state,
      action: PayloadAction<{
        usage: LlmUsageChange
      }>,
    ) => {
      const { premium, standard } = action.payload.usage
      state.usage.premium.promptTokens += premium?.promptTokens ?? 0
      state.usage.premium.completionTokens += premium?.completionTokens ?? 0
      state.usage.standard.promptTokens += standard?.promptTokens ?? 0
      state.usage.standard.completionTokens += standard?.completionTokens ?? 0
    },
    prCreationStatusChanged: (state, action: PayloadAction<{ status: PrCreationStatus }>) => {
      state.prCreationStatus = action.payload.status
    },
    prSplitCompleted: (state) => {
      state.page = 'MENU'
      state.prUrl = initialState.prUrl
      state.prInfo = initialState.prInfo
      state.enhancedPrInfo = initialState.enhancedPrInfo
      state.hunks = initialState.hunks
      state.localPath = initialState.localPath
      state.initialHunksGroups = initialState.initialHunksGroups
      state.refinedHunksGroups = initialState.refinedHunksGroups
      state.commitedHunkGroups = initialState.commitedHunkGroups
      state.pullRequests = initialState.pullRequests
      state.splitStatus = initialState.splitStatus
      state.prCreationStatus = initialState.prCreationStatus
      state.error = initialState.error
      state.numHunksGrouped = initialState.numHunksGrouped
    },
    userSelectedHunkGroup: (state, action: PayloadAction<{ group: HunkGroup }>) => {
      state.selectedHunkGroup = action.payload.group
    },
    userClearedSelectedHunkGroup: (state) => {
      state.selectedHunkGroup = null
    },
  },
  extraReducers: (builder) => {
    builder.addCase(init.pending, (state) => {
      state.page = 'LOADING'
    })
    builder.addCase(init.rejected, (state, action) => {
      state.error = action.error
    })
    builder.addCase(splitPullRequest.pending, (state, action) => {
      state.splitStatus = 'NOT_STARTED'
      state.prUrl = action.meta.arg.prUrl
    })
    builder.addCase(splitPullRequest.rejected, (state, action) => {
      state.splitStatus = 'FAILED'
      state.error = action.error
    })
    builder.addCase(createCommits.pending, (state) => {
      state.prCreationStatus = 'COMMITTING_GROUPS'
    })
    builder.addCase(createCommits.fulfilled, (state, action) => {
      state.commitedHunkGroups = action.payload.commitedGroups
      state.prCreationStatus = 'COMMITTED_GROUPS'
    })
    builder.addCase(createCommits.rejected, (state, action) => {
      state.prCreationStatus = 'FAILED'
      state.error = action.error
    })
    builder.addCase(pushCommitedGroupBranches.pending, (state) => {
      state.prCreationStatus = 'PUSHING_BRANCHES'
    })
    builder.addCase(pushCommitedGroupBranches.fulfilled, (state) => {
      state.prCreationStatus = 'PUSHED_BRANCHES'
    })
    builder.addCase(pushCommitedGroupBranches.rejected, (state, action) => {
      state.splitStatus = 'FAILED'
      state.error = action.error
    })
    builder.addCase(createPullRequests.pending, (state) => {
      state.prCreationStatus = 'CREATING_PULL_REQUESTS'
    })
    builder.addCase(createPullRequests.fulfilled, (state, action) => {
      state.pullRequests = action.payload.pullRequests
      state.prCreationStatus = 'ASKING_FOR_PERMISSION_TO_CLOSE_ORIGINAL_PULL_REQUEST'
    })
    builder.addCase(createPullRequests.rejected, (state, action) => {
      state.prCreationStatus = 'FAILED'
      state.error = action.error
    })
    builder.addCase(closeOriginalPullRequest.pending, (state) => {
      state.prCreationStatus = 'CLOSING_ORIGINAL_PULL_REQUEST'
    })
    builder.addCase(closeOriginalPullRequest.fulfilled, (state) => {
      state.prCreationStatus = 'CLOSED_ORIGINAL_PULL_REQUEST'
    })
    builder.addCase(closeOriginalPullRequest.rejected, (state, action) => {
      state.prCreationStatus = 'FAILED'
      state.error = action.error
    })
  },
})

export const {
  setStore,
  secretConfigRequested,
  secretConfigSet,
  pullRequestUrlRequested,
  repoConfigRequested,
  startedCloningRepo,
  finishedCloningRepo,
  parsedDiff,
  prCreationStatusChanged,
  prSplitCompleted,
  hunkGrouped,
  startedSplittingPullRequest,
  startedCreatingEmbeddings,
  startedGroupingHunks,
  finishedGroupingHunks,
  startedRefiningGroups,
  finishedRefiningGroups,
  finishedSplit,
  movedToPullRequestCreation,
  configSet,
  stepChanged,
  usageIncreased,
  userSelectedHunkGroup,
  userClearedSelectedHunkGroup,
} = appSlice.actions

export const reducer = appSlice.reducer
