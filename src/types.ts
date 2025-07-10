import { RestEndpointMethodTypes } from '@octokit/rest'
import { Endpoints } from '@octokit/types'
import { SimpleGit } from 'simple-git'
import z from 'zod'

export type GitHubPullRequest =
  Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}']['response']['data']

export type Commit =
  Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}/commits']['response']['data'][number]

export type GitHubPullRequestCreateResponse = RestEndpointMethodTypes['pulls']['create']['response']

// The user provides a pull request URL. We parse it to get the owner, repo,
// PR number, and repo URL.
export interface PullRequestInfo {
  owner: string
  repo: string
  prNumber: string
  repoUrl: string
}

// We request pull request information from the GitHub API
export interface EnhancedPullRequestInfo extends PullRequestInfo {
  baseBranch: string
  headBranch: string
  baseSha: string
  headSha: string
  link: string
  title: string
  description: string
  commits: Commit[]
  files: string[]
}

// When cloning a repository, it's helpful to the rest of the program
// to known where it was cloned to (a temp directory that changes every time)
// and the git instance which is used to do git operations
export interface CloneResult {
  tempDir: string
  git: SimpleGit
}

// At the moment only OpenAI, Anthropic, and Google Gemini are supported
// but more can be added later
export enum LLMProvider {
  OPENAI = 'OpenAI',
  ANTHROPIC = 'Anthropic',
  GEMINI = 'Google Gemini',
}

// All the information needed to send requests to an LLM.
// User enters this information when the app is first run.
// The `endpoint` is optional, but allows the user to
// specify private LLM endpoints used by their own organization.
export type LLMConfig = z.infer<typeof LLMConfigSchema>
export const LLMConfigSchema = z.object({
  provider: z.nativeEnum(LLMProvider),
  apiKey: z.string(),
  endpoint: z.string().optional(),
})

// This program calls LLMs many times for different tasks
// some require a premium model, some require a standard model
export enum ModelTier {
  PREMIUM = 'premium',
  STANDARD = 'standard',
}

// The usage of the LLMs for the session
// Premium like GPT-5 or Claude 4.5 Sonnet
// Standard like GPT-4.1 or Claude .5 Haiku
export type LlmUsage = {
  premium: {
    promptTokens: number
    completionTokens: number
  }
  standard: {
    promptTokens: number
    completionTokens: number
  }
}

// The usage of the LLMs for the session
// Which is different from the LlmUsage in that both
// premium and standard are optional
export type LlmUsageChange = {
  premium?: {
    promptTokens: number
    completionTokens: number
  }
  standard?: {
    promptTokens: number
    completionTokens: number
  }
}

// Schema for the secret config stored in keychain
// We separate this from the rest of the config
export type SecretConfig = z.infer<typeof SecretConfigSchema>
export const SecretConfigSchema = z.object({
  githubToken: z.string(),
  llmConfig: LLMConfigSchema,
})

// Users will want to configure behavior that is specific to a repo.
// For example, the test command to run to validate while splitting the PR.
export type RepoConfig = z.infer<typeof RepoConfigSchema>
export const RepoConfigSchema = z.object({
  testCommand: z.string(),
})

// Schema for the non-secret config stored in a file
// in the user's home directory.
export type Config = z.infer<typeof ConfigSchema>
export const ConfigSchema = z.object({
  repoConfigs: z.record(z.string(), RepoConfigSchema),
})

// We never pass a binary or unrecognized hunk to an LLM
// only text hunks (code changes). This is determined
// when parsing the hunk
export enum HunkType {
  TEXT = 'text',
  BINARY = 'binary',
  UNRECOGNIZED = 'unrecognized',
}

// The canonical representation of a hunk.
// Fit for anything! (except validating groupings using the `hash` field)
export interface VectorHunkEntryWithoutId {
  type: HunkType // Text, binary, or unrecognized
  filePath: string // Path to the file that the hunk is in
  content: string // Hunk content only (for embeddings, search, display)
  summary: string // Human-readable description which is vectorized for semantic search
  embedding: number[] // Vector representation which is used for similarity search
  completePatch: string // Full patch with headers for git apply
  linesAdded: number // Number of lines added in the hunk
  linesRemoved: number // Number of lines removed in the hunk
}

// `hash` is added to the Hunk to make it easier to do benchmarks.
// We expect that this program can group hunks in a PR correctly and we verify
// that by comparing the output (specifically the `hash` field) to the
// expected output (in the `gold/` directory).
export interface VectorHunkEntry extends VectorHunkEntryWithoutId {
  hash: string
}

// We parse the raw text of the output of `git diff` and create these objects.
// Each type is passed to the LLM differently. e.g., no sense in sending a binary
// to the LLM.
interface BaseHunk {
  completePatch: string // Full patch with headers for git apply
  operation: 'added' | 'deleted' | 'modified' | 'renamed' // Unified operation type
  filePath: string
  previousFilePath?: string
}

// This is the best kind of hunk. It's a code change. LLMs like text.
export interface TextHunk extends BaseHunk {
  type: HunkType.TEXT
  linesRemoved: number
  linesAdded: number
  content: string // Patch without headers
  header: string // Patch header
  index: number // Index of the hunk in the file
}

// git will tell us if the diff is a binary.
// We pass the LLM something like "A binary hunk at <path> was <added/deleted/modified/renamed>"
export interface BinaryHunk extends BaseHunk {
  type: HunkType.BINARY
}

// Something went wrong when parsing the diff. We'll fail gracefully. Maybe secretly... silently...
export interface UnrecognizedHunk extends BaseHunk {
  type: HunkType.UNRECOGNIZED
}

export type ParsedHunk = BinaryHunk | TextHunk | UnrecognizedHunk

// For each _file_ that's been changed in the pull request, we try to figure out
// if it's 'opaque' or 'summarizable'. Summarizable just meaning we can pass the content to an LLM.
// "Opaque" meaning it's opaque to the LLM. Some examples: any huge auto-generated file like a yarn.lock, an SVG, or binary file
export interface FileStatistics {
  filePath: string
  linesAdded: number
  linesRemoved: number
  sample: string
  hunks: TextHunk[]
}

// After calculating the file stats, we ask the LLM to categorize the file as 'opaque' or 'summarizable'.
export interface FileStatisticsAndTag extends FileStatistics {
  tag: 'opaque' | 'summarizable'
}

// We split a pull request by grouping similar hunks together. The description
// is generated by the LLM as it creates and adds to the groups.
export type HunkGroup = {
  description: string
  hunks: VectorHunkEntry[]
}

// When the user reviews the hunks groups and approves, we commit the groups
// locally and push their branches.
export type CommitedHunkGroup = {
  hunkGroup: HunkGroup
  branchName: string
  commitSha: string
}

// While committing each group, we apply each hunk one by one.
// There's a possibility that the hunk application failed due to conflicts.
// I don't know if this actually happens in practice.
export type HunkApplicationResult =
  | {
      success: true
      message: string
    }
  | {
      success: false
      message: string
      conflictDetails: string
    }

// After the groups are created, committed, and pushed, we prepare this list
// of pull requests to open using the group name as the description.
export type PrCreationData = {
  base: string
  head: string
  owner: string
  repo: string
  title: string
  body: string
}
