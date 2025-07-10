import { PullRequestInfo } from './types'

export const extractGitHubMatch = (url: string): RegExpMatchArray | null =>
  url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/)

export const createAuthenticatedRepoUrl = (owner: string, repo: string, token?: string): string => {
  if (token) {
    return `https://${token}@github.com/${owner}/${repo}.git`
  }
  return `https://github.com/${owner}/${repo}.git`
}

export const createPrInfo = (
  [, owner, repo, prNumber]: RegExpMatchArray,
  token?: string,
): PullRequestInfo => ({
  owner,
  repo,
  prNumber,
  repoUrl: createAuthenticatedRepoUrl(owner, repo, token),
})

export const parsePullRequestUrl = (url: string, token?: string): PullRequestInfo => {
  const match = extractGitHubMatch(url)
  if (!match) {
    throw new Error('Unsupported PR URL format. Please provide a GitHub PR URL.')
  }
  return createPrInfo(match, token)
}
