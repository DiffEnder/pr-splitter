import { LLMConfig, LLMProvider, ModelTier } from './types'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'

interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 6,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
}

const isRetryableError = (error: any): boolean => {
  if (!error) return false

  const message = error.message?.toLowerCase() || ''
  const code = error.code?.toLowerCase() || ''

  // Rate limiting errors
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return true
  }

  if (
    error.status === 429 ||
    error.status === 500 ||
    error.status === 502 ||
    error.status === 503 ||
    error.status === 504
  ) {
    return true
  }

  // Network errors
  if (code.includes('network') || code.includes('timeout') || code.includes('connection')) {
    return true
  }

  return false
}

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const withRetry = async <T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  operation: string = 'LLM API call',
): Promise<T> => {
  let lastError: any
  let delay = config.initialDelayMs

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(delay)
      }

      const result = await fn()

      return result
    } catch (error) {
      lastError = error

      if (attempt === config.maxRetries) {
        break
      }

      if (!isRetryableError(error)) {
        throw error
      }

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs)
    }
  }

  throw lastError
}

export const createAIProvider = (config: LLMConfig, tier: ModelTier = ModelTier.STANDARD) => {
  const keyAndEndpoint = {
    apiKey: config.apiKey,
    baseURL: config.endpoint || 'https://api.openai.com/v1',
  }
  if (config.provider === LLMProvider.OPENAI && tier === ModelTier.PREMIUM)
    return createOpenAI({
      ...keyAndEndpoint,
      compatibility: 'strict',
    })('gpt-4.1')

  if (config.provider === LLMProvider.OPENAI && tier === ModelTier.STANDARD)
    return createOpenAI({
      ...keyAndEndpoint,
      compatibility: 'strict',
    })('gpt-4.1-mini')

  if (config.provider === LLMProvider.ANTHROPIC && tier === ModelTier.PREMIUM)
    return createAnthropic({
      ...keyAndEndpoint,
    })('claude-4-sonnet-20250514')

  if (config.provider === LLMProvider.ANTHROPIC && tier === ModelTier.STANDARD)
    return createAnthropic({
      ...keyAndEndpoint,
    })('claude-3-5-haiku-latest')

  if (config.provider === LLMProvider.GEMINI && tier === ModelTier.PREMIUM)
    return createGoogleGenerativeAI({
      ...keyAndEndpoint,
    })('gemini-2.5-pro')

  if (config.provider === LLMProvider.GEMINI && tier === ModelTier.STANDARD)
    return createGoogleGenerativeAI({
      ...keyAndEndpoint,
    })('gemini-2.5-flash')

  throw new Error(
    `${config.provider} provider integration not yet implemented. Please use OpenAI, Anthropic, or Google Gemini for now.`,
  )
}
