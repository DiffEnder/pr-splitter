import keytar from 'keytar'
import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { Config, ConfigSchema, RepoConfig, SecretConfig, SecretConfigSchema } from './types'

const SERVICE_NAME = 'pr-splitter'
const ACCOUNT_NAME = 'default'

export const setSecretConfig = async (secret: SecretConfig) => {
  try {
    const secretJson = JSON.stringify(secret)
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, secretJson)
  } catch (error) {
    console.error(`Failed to set secret: ${error}`)
    throw error
  }
}

export const getSecretConfig = async (): Promise<SecretConfig | null> => {
  const secretJson = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
  if (!secretJson) return null
  return SecretConfigSchema.parse(JSON.parse(secretJson))
}

export const getConfig = async (): Promise<Config | null> => {
  const configJson = await fs.readFile(getConfigFilePath(), 'utf8')
  if (!configJson) return null
  return ConfigSchema.parse(JSON.parse(configJson))
}

export const getRepoIdentifier = ({ owner, repo }: { owner: string; repo: string }): string => {
  return `https://github.com/${owner}/${repo}`
}

export const getRepoConfig = async ({
  owner,
  repo,
}: {
  owner: string
  repo: string
}): Promise<RepoConfig | null> => {
  const config = await getConfig()
  if (!config) return null
  const repoIdentifier = getRepoIdentifier({ owner, repo })
  return config.repoConfigs[repoIdentifier]
}

export const setConfig = async (config: Config) => {
  const configJson = JSON.stringify(config, null, 2)
  await fs.writeFile(getConfigFilePath(), configJson)
}

const getConfigFilePath = (): string => path.join(os.homedir(), '.pr-splitter/config.json')

export const ensureConfigFile = async (): Promise<void> => {
  const configPath = getConfigFilePath()
  await fs.ensureDir(path.dirname(configPath))

  if (!(await fs.pathExists(configPath)))
    await fs.writeFile(configPath, JSON.stringify({ repoConfigs: {} }, null, 2))
}
