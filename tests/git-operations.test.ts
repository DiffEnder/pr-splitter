import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { setupRepository } from '../src/git-operations'
import { EnhancedPullRequestInfo } from '../src/types'
import { SimpleGit } from 'simple-git'

describe('Git Operations', () => {
  // Use a small, well-known open source repository for testing
  const testPrInfo: EnhancedPullRequestInfo = {
    owner: 'octocat',
    repo: 'Hello-World',
    prNumber: '1',
    repoUrl: 'https://github.com/octocat/Hello-World.git',
    baseBranch: 'master',
    headBranch: 'test-branch',
    baseSha: 'abc123',
    headSha: 'def456',
    link: 'https://github.com/octocat/Hello-World/pull/1',
    title: 'Test PR',
    description: 'Test description',
    commits: [],
    files: [],
  }

  let tempDir: string
  let git: SimpleGit

  afterEach(async () => {
    // Clean up after each test
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true })
      tempDir = ''
    }
  })

  describe('setupRepository', () => {
    it('should clone repository and setup PR branch successfully', async () => {
      // Act
      const result = await setupRepository(testPrInfo)
      tempDir = result.tempDir
      git = result.git

      // Assert
      expect(result).toBeDefined()
      expect(result.tempDir).toBeTruthy()
      expect(result.git).toBeDefined()

      // Verify the temporary directory exists
      const dirStats = await fs.stat(tempDir)
      expect(dirStats.isDirectory()).toBe(true)

      // Verify it's a git repository
      const gitDirExists = await fs
        .access(join(tempDir, '.git'))
        .then(() => true)
        .catch(() => false)
      expect(gitDirExists).toBe(true)
    })

    it('should fetch and checkout the PR branch', async () => {
      // Act
      const result = await setupRepository(testPrInfo)
      tempDir = result.tempDir
      git = result.git
    })

    it('should handle invalid PR number gracefully', async () => {
      // Arrange - valid repo but invalid PR number
      const invalidPrInfo: EnhancedPullRequestInfo = {
        owner: 'octocat',
        repo: 'Hello-World',
        prNumber: '999999',
        repoUrl: 'https://github.com/octocat/Hello-World.git',
        link: 'https://github.com/octocat/Hello-World/pull/999999',
        baseBranch: 'main',
        headBranch: 'test-branch',
        baseSha: 'abc123',
        headSha: 'def456',
        title: 'Test PR',
        description: 'Test description',
        commits: [],
        files: [],
      }

      // Act & Assert
      await expect(setupRepository(invalidPrInfo)).rejects.toThrow()
    })
  })
})
