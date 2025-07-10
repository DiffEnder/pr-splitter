import simpleGit, { SimpleGit } from 'simple-git'
import {
  CloneResult,
  CommitedHunkGroup,
  HunkApplicationResult,
  HunkGroup,
  VectorHunkEntry,
  EnhancedPullRequestInfo,
} from './types'
import { createTempDirectory } from './file-system'
import fs from 'fs-extra'
import tmp from 'tmp'

export const cloneRepository = async (repoUrl: string, tempDir: string): Promise<void> => {
  const git = simpleGit()
  await git.clone(repoUrl, tempDir)
}

export const fetchPullRequestBranches = async (
  git: SimpleGit,
  prInfo: EnhancedPullRequestInfo,
): Promise<void> => {
  const headBranch = `pull/${prInfo.prNumber}/head:pr-${prInfo.prNumber}`
  await git.fetch(['origin', headBranch])
  await git.fetch(['origin', prInfo.baseBranch])
}

export const setupRepository = async (prInfo: EnhancedPullRequestInfo): Promise<CloneResult> => {
  const tempDir = await createTempDirectory()

  try {
    await cloneRepository(prInfo.repoUrl, tempDir)
  } catch (error) {
    throw error
  }

  const repoGit = simpleGit(tempDir)

  try {
    await fetchPullRequestBranches(repoGit, prInfo)
  } catch (error) {
    console.error(error)
    throw error
  }

  return { tempDir, git: repoGit }
}

export const stagePaths = async (git: SimpleGit, options: { paths: string[] }): Promise<string> => {
  try {
    await git.add(options.paths)
    return 'ok'
  } catch (error) {
    throw error
  }
}

export const reset = async (
  git: SimpleGit,
  options: {
    mode: 'soft' | 'mixed' | 'hard'
    to: string
  },
): Promise<string> => {
  try {
    await git.reset([`--${options.mode}`, options.to])
    return 'ok'
  } catch (error) {
    throw error
  }
}

export const commit = async (
  git: SimpleGit,
  options: {
    message: string
    amend?: boolean
  },
): Promise<{ sha: string }> => {
  const { message, amend = false } = options

  if (amend) {
    const result = await git.commit(message, undefined, { '--amend': null })
    return { sha: result.commit }
  } else {
    const result = await git.commit(message)
    return { sha: result.commit }
  }
}

export const commitGroups = async ({
  git,
  enhancedPrInfo,
  groups,
}: {
  git: SimpleGit
  enhancedPrInfo: EnhancedPullRequestInfo
  groups: HunkGroup[]
}): Promise<CommitedHunkGroup[]> => {
  // We create a commit per group, and each commit is based on the previous commit
  // Each commit gets its own branch, like `pr-splitter/pr#123-group-1
  const commitedGroups: CommitedHunkGroup[] = []
  let nextShaToBranchFrom = enhancedPrInfo.baseSha
  let groupNumber = 1
  for (const group of groups) {
    // `pr-splitter` prefix because it's the entity that created the branch
    // `pr#{number}` so it's easy to identify the source pull request
    // `group#{number}` to signify that this is the nth group of the pull request
    const branchName = `pr-splitter/pr#${enhancedPrInfo.prNumber}-group#${groupNumber}`

    // Start first at the base sha, then the sha of the commit we created in the previous iteration
    await createBranch(git, {
      name: branchName,
      startPoint: nextShaToBranchFrom,
      checkout: true,
    })

    // Reset hard to the branch we just checked out in order to
    // have a clean working directory. But I don't remember in which scenario
    // the working directory wouldn't be clean.
    await reset(git, { mode: 'hard', to: nextShaToBranchFrom })

    for (const hunk of group.hunks) {
      const result = await applyHunk(git, hunk)
      if (!result.success) throw new Error(`${result.message}\n${result.conflictDetails}`)
    }
    const files = group.hunks.map((hunk) => hunk.filePath)
    await stagePaths(git, { paths: files })

    const commitResult = await commit(git, { message: group.description })
    commitedGroups.push({
      hunkGroup: group,
      branchName,
      commitSha: commitResult.sha,
    })
    nextShaToBranchFrom = commitResult.sha
    groupNumber++
  }

  return commitedGroups
}

export const createBranch = async (
  git: SimpleGit,
  options: {
    name: string
    startPoint?: string
    checkout?: boolean
  },
): Promise<string> => {
  const { name, startPoint = 'HEAD', checkout = false } = options

  try {
    if (checkout) {
      await git.checkoutBranch(name, startPoint)
    } else {
      await git.branch([name, startPoint])
    }
    return 'ok'
  } catch (error) {
    throw error
  }
}

export const applyHunk = async (
  git: SimpleGit,
  hunk: VectorHunkEntry,
): Promise<HunkApplicationResult> => {
  try {
    // Create temporary patch file using the complete patch with headers
    const tmpFile = tmp.fileSync({ postfix: '.patch' })

    // Use the completePatch for git apply (contains proper headers)
    const patchContent = hunk.completePatch
    await fs.writeFile(tmpFile.name, patchContent, 'utf8')

    try {
      // First, check if the patch can be applied cleanly
      await git.raw(['apply', '--check', tmpFile.name])

      // Apply the patch
      await git.raw(['apply', tmpFile.name])

      return {
        success: true,
        message: `Successfully applied hunk to ${hunk.filePath}`,
      }
    } catch (applyError: any) {
      // Check if it's a conflict or other error
      const errorMessage = applyError.message || String(applyError)

      return {
        success: false,
        message: `Failed to apply hunk to ${hunk.filePath}`,
        conflictDetails: errorMessage,
      }
    } finally {
      await fs.unlink(tmpFile.name)
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Error processing hunk for ${hunk.filePath}: ${error.message}`,
      conflictDetails: 'No conflict details available',
    }
  }
}
