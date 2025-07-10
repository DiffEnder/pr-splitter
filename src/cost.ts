import { ModelTier, LLMConfig, LLMProvider } from './types'

export const getCostPer1M = ({
  modelTier,
  config,
}: {
  modelTier: ModelTier
  config: LLMConfig
}) => {
  if (config.provider === LLMProvider.OPENAI) {
    // gpt-4.1 input: $2.00 / 1M tokens output: $8.00 / 1M tokens
    if (modelTier === ModelTier.PREMIUM) return { prompt: 2, completion: 8 }
    // gpt-4.1-mini input: $0.40 / 1M tokens output: $1.60 / 1M tokens
    return { prompt: 0.4, completion: 1.6 }
  }

  if (config.provider === LLMProvider.ANTHROPIC) {
    // Claude 4 Sonnet input: $3.00 / 1M tokens output: $15.00 / 1M tokens
    if (modelTier === ModelTier.PREMIUM) return { prompt: 3, completion: 15 }
    // Claude 3.5 Haiku input: $0.80 / 1M tokens output: $4.00 / 1M tokens
    return { prompt: 0.8, completion: 4 }
  }

  if (config.provider === LLMProvider.GEMINI) {
    // Gemini 2.5 Pro input: $1.25 / 1M tokens output: $10.00 / 1M tokens
    if (modelTier === ModelTier.PREMIUM) return { prompt: 1.25, completion: 10 }
    // Gemini 2.5 Flash input: $0.30 / 1M tokens output: $2.50 / 1M tokens
    return { prompt: 0.3, completion: 2.5 }
  }

  throw new Error(`Unsupported LLM provider: ${config.provider}`)
}
