import { Octokit } from '@octokit/rest'
import { Commit, EnhancedPullRequestInfo, GitHubPullRequest, PullRequestInfo } from './types'
import map from 'lodash/fp/map.js'
import get from 'lodash/fp/get.js'

export const getIsTokenValid = async (token: string): Promise<boolean> => {
  const octokit = new Octokit({ auth: token })
  try {
    const { data: user } = await octokit.rest.users.getAuthenticated()
    return user !== null
  } catch (error) {
    return false
  }
}

export const fetchPullRequestMetadata = async ({
  prInfo,
  githubToken,
}: {
  prInfo: PullRequestInfo
  githubToken: string
}): Promise<{
  pullRequest: GitHubPullRequest
  commits: Commit[]
  files: string[]
}> => {
  const octokit = new Octokit({ auth: githubToken })
  const [{ data: pr }, { data: commitsData }] = await Promise.all([
    octokit.rest.pulls.get({
      owner: prInfo.owner,
      repo: prInfo.repo,
      pull_number: Number(prInfo.prNumber),
    }),
    octokit.rest.pulls.listCommits({
      owner: prInfo.owner,
      repo: prInfo.repo,
      pull_number: Number(prInfo.prNumber),
    }),
  ])

  const { data: compareData } = await octokit.rest.repos.compareCommits({
    owner: prInfo.owner,
    repo: prInfo.repo,
    base: pr.base.sha,
    head: pr.head.sha,
  })

  return {
    pullRequest: pr,
    commits: commitsData,
    files: map(get('filename'), compareData.files || []),
  }
}

export const enhancePullRequestInfo = async ({
  prInfo,
  githubToken,
}: {
  prInfo: PullRequestInfo
  githubToken: string
}): Promise<EnhancedPullRequestInfo> => {
  const { pullRequest, commits, files } = await fetchPullRequestMetadata({
    prInfo,
    githubToken,
  })

  return {
    ...prInfo,
    baseBranch: pullRequest.base.ref,
    headBranch: pullRequest.head.ref,
    baseSha: commits[0].parents[0].sha,
    headSha: pullRequest.head.sha,
    link: pullRequest.html_url,
    title: pullRequest.title,
    description: pullRequest.body || '',
    commits: commits,
    files: files,
  }
}
