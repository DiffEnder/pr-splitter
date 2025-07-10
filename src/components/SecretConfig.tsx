import { useState } from 'react'
import { ConfirmInput, PasswordInput, Select, TextInput } from '@inkjs/ui'
import { LLMProvider } from '../types'
import { stepChanged } from '../redux/slice'
import { useAppDispatch, useAppSelector } from '../redux/hooks'
import {
  selectLLMAPIKey,
  selectLLMEndpoint,
  selectGithubToken,
  selectLLMProvider,
} from '../redux/selectors'
import { Box, Text } from 'ink'
import { updateSecretConfig } from '../redux/thunks/mainThunks'
import { PRIMARY_COLOR, SECONDARY_COLOR } from './styles'

type SubStep =
  | 'SELECTING_PROVIDER'
  | 'ASK_IF_CHANGING_ENDPOINT'
  | 'ASK_IF_CUSTOM_ENDPOINT'
  | 'ASK_IF_CHANGING_API_KEY'
  | 'ASK_IF_CHANGING_GITHUB_TOKEN'
  | 'ENTERING_API_KEY'
  | 'ENTERING_ENDPOINT'
  | 'ENTERING_GITHUB_TOKEN'
  | 'ENTERING_ENDPOINT_COMPATIBILITY'

export const SecretConfig = () => {
  const dispatch = useAppDispatch()

  const llmProvider = useAppSelector(selectLLMProvider)
  const llmEndpoint = useAppSelector(selectLLMEndpoint)
  const llmApiKey = useAppSelector(selectLLMAPIKey)
  const githubToken = useAppSelector(selectGithubToken)

  const [subStep, setSubStep] = useState<SubStep>('SELECTING_PROVIDER')
  const [provider, setProvider] = useState<LLMProvider | null>(llmProvider)
  const [apiKey, setApiKey] = useState<string | null>(llmApiKey)
  const [endpoint, setEndpoint] = useState<string | null>(llmEndpoint)

  const chooseNextSubStep = ({
    currentStep,
    confirm = true,
  }: {
    currentStep: SubStep
    confirm?: boolean
  }): SubStep => {
    // This logic used to be split across all of the `onConfirm` and `onCancel` callbacks in each UI component
    // and tracing the flow was so difficult. To make it easier to track the transitions between steps, they're
    // grouped into a single function.

    // Usually after selecting the provider we transition to asking whether there is a custom endpoint.
    // But there is a special case if the user selects "Other/Custom". We transtion them
    // to the "ENTERING_ENDPOINT_COMPATIBILITY" step. Because at that point we don't know the API format yet and
    // we want to collect this before collecting the custom endpoint.
    if (currentStep === 'SELECTING_PROVIDER') return 'ASK_IF_CUSTOM_ENDPOINT'

    // Endpoint Compatibility -> Endpoint
    if (currentStep === 'ENTERING_ENDPOINT_COMPATIBILITY') return 'ENTERING_ENDPOINT'

    // Custom Endpoint -> (API Key) or (Endpoint)
    if (currentStep === 'ASK_IF_CUSTOM_ENDPOINT' && confirm && llmEndpoint)
      return 'ASK_IF_CHANGING_ENDPOINT'
    if (currentStep === 'ASK_IF_CUSTOM_ENDPOINT' && confirm) return 'ENTERING_ENDPOINT'
    if (currentStep === 'ASK_IF_CUSTOM_ENDPOINT' && llmApiKey) return 'ASK_IF_CHANGING_API_KEY'
    if (currentStep === 'ASK_IF_CUSTOM_ENDPOINT') return 'ENTERING_API_KEY'

    // Endpoint -> API Key
    if (currentStep === 'ASK_IF_CHANGING_ENDPOINT' && confirm) return 'ENTERING_ENDPOINT'
    if (currentStep === 'ASK_IF_CHANGING_ENDPOINT' && llmApiKey) return 'ASK_IF_CHANGING_API_KEY'
    if (currentStep === 'ASK_IF_CHANGING_ENDPOINT') return 'ENTERING_API_KEY'

    // Endpoint -> API Key
    if (currentStep === 'ENTERING_ENDPOINT' && llmApiKey) return 'ASK_IF_CHANGING_API_KEY'
    if (currentStep === 'ENTERING_ENDPOINT') return 'ENTERING_API_KEY'

    // API Key -> GitHub Token
    if (currentStep === 'ASK_IF_CHANGING_API_KEY' && confirm) return 'ENTERING_API_KEY'
    if (currentStep === 'ASK_IF_CHANGING_API_KEY' && githubToken)
      return 'ASK_IF_CHANGING_GITHUB_TOKEN'
    if (currentStep === 'ASK_IF_CHANGING_API_KEY') return 'ENTERING_GITHUB_TOKEN'

    // API Key -> GitHub Token
    if (currentStep === 'ENTERING_API_KEY' && githubToken) return 'ASK_IF_CHANGING_GITHUB_TOKEN'
    if (currentStep === 'ENTERING_API_KEY') return 'ENTERING_GITHUB_TOKEN'

    // GitHub Token is the final step so we only handle the case where the user confirms
    // they want to change the GitHub token. If it's any other GITHUB_TOKEN step, then we
    // throw an error because there is no next step and the caller should handle submission.
    if (currentStep === 'ASK_IF_CHANGING_GITHUB_TOKEN' && confirm) return 'ENTERING_GITHUB_TOKEN'

    throw new Error(`Invalid step: ${currentStep}`)
  }

  const handleSubmit = async (value: string) => {
    if (!value) return
    if (!provider || !apiKey)
      throw new Error(
        `Missing required values: ${JSON.stringify({ value, provider, apiKey, endpoint })}`,
      )
    await dispatch(
      updateSecretConfig({
        githubToken: value,
        provider,
        apiKey,
        endpoint: endpoint ?? undefined,
        // We clear the endpoint from the config if:
        //   - It wasn't set when user was starting the configuration flow, and the user said they didn't want a custom endpoint
        //   - It was set when the user was starting the configuration flow, but then the user said they didn't want a custom endpoint
        clearEndpoint: endpoint === null,
      }),
    ).unwrap()
    dispatch(stepChanged({ step: 'MENU' }))
  }

  if (subStep === 'SELECTING_PROVIDER')
    return (
      <Box flexDirection="column">
        <Text>Which LLM provider do you want to use?</Text>
        <Select
          options={[
            {
              label: 'OpenAI',
              value: LLMProvider.OPENAI,
            },
            {
              label: 'Anthropic',
              value: LLMProvider.ANTHROPIC,
            },
            {
              label: 'Google Gemini',
              value: LLMProvider.GEMINI,
            },
            {
              label: 'Other/Custom',
              value: 'CUSTOM',
            },
          ]}
          onChange={(value) => {
            if (value === 'CUSTOM') {
              setSubStep('ENTERING_ENDPOINT_COMPATIBILITY')
              return
            }
            setProvider(value as LLMProvider)
            setSubStep(chooseNextSubStep({ currentStep: subStep }))
          }}
        />
      </Box>
    )
  else if (subStep === 'ASK_IF_CHANGING_ENDPOINT') {
    return (
      <Box flexDirection="row" gap={1}>
        <Text>Do you want to change the LLM endpoint?</Text>
        <Box>
          <Text color={SECONDARY_COLOR}>(</Text>
          <ConfirmInput
            onConfirm={() => setSubStep(chooseNextSubStep({ currentStep: subStep, confirm: true }))}
            onCancel={() => {
              setSubStep(chooseNextSubStep({ currentStep: subStep, confirm: false }))
            }}
          />
          <Text color={SECONDARY_COLOR}>)</Text>
        </Box>
      </Box>
    )
  } else if (subStep === 'ASK_IF_CUSTOM_ENDPOINT') {
    return (
      <Box flexDirection="row" gap={1}>
        <Text>Are you using a custom endpoint? (e.g., Azure OpenAI, company proxy)</Text>
        <Box>
          <Text color={SECONDARY_COLOR}>(</Text>
          <ConfirmInput
            onConfirm={() => setSubStep(chooseNextSubStep({ currentStep: subStep, confirm: true }))}
            onCancel={() => {
              setEndpoint(null)
              setSubStep(chooseNextSubStep({ currentStep: subStep, confirm: false }))
            }}
          />
          <Text color={SECONDARY_COLOR}>)</Text>
        </Box>
      </Box>
    )
  } else if (subStep === 'ASK_IF_CHANGING_API_KEY') {
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text>Do you want to change the LLM API key?</Text>
          <Box>
            <Text color={SECONDARY_COLOR}>(</Text>
            <ConfirmInput
              onConfirm={() =>
                setSubStep(chooseNextSubStep({ currentStep: subStep, confirm: true }))
              }
              onCancel={() => {
                setSubStep(chooseNextSubStep({ currentStep: subStep, confirm: false }))
              }}
            />
            <Text color={SECONDARY_COLOR}>)</Text>
          </Box>
        </Box>
      </Box>
    )
  } else if (subStep === 'ENTERING_ENDPOINT_COMPATIBILITY') {
    return (
      <Box key="endpoint-compatibility" flexDirection="column">
        <Text>What API format does your endpoint use?</Text>
        <Select
          options={[
            {
              label: 'OpenAI-compatible',
              value: LLMProvider.OPENAI,
            },
            {
              label: 'Anthropic-compatible',
              value: LLMProvider.ANTHROPIC,
            },
            {
              label: 'Google Gemini-compatible',
              value: LLMProvider.GEMINI,
            },
          ]}
          onChange={(value) => {
            setProvider(value as LLMProvider)
            setSubStep(chooseNextSubStep({ currentStep: subStep }))
          }}
        />
      </Box>
    )
  } else if (subStep === 'ENTERING_API_KEY') {
    return (
      // Using a key because the input is not re-rendered when the subStep changes
      <Box key="api-key" flexDirection="row" gap={1}>
        <Text>{provider} API key:</Text>
        <Box>
          <Text color={SECONDARY_COLOR}>(</Text>
          <PasswordInput
            onSubmit={(value) => {
              if (!value) return
              setApiKey(value)
              setSubStep(chooseNextSubStep({ currentStep: subStep, confirm: true }))
            }}
          />
          <Text color={SECONDARY_COLOR}>)</Text>
        </Box>
      </Box>
    )
  } else if (subStep === 'ENTERING_ENDPOINT') {
    return (
      <Box flexDirection="row" gap={1}>
        <Text>LLM endpoint:</Text>
        <Box>
          <Text color={SECONDARY_COLOR}>(</Text>
          <TextInput
            placeholder="Enter LLM endpoint"
            onSubmit={(value) => {
              if (!value) return
              setEndpoint(value)
              setSubStep(chooseNextSubStep({ currentStep: subStep, confirm: true }))
            }}
          />
          <Text color={SECONDARY_COLOR}>)</Text>
        </Box>
      </Box>
    )
  } else if (subStep === 'ASK_IF_CHANGING_GITHUB_TOKEN') {
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text>Do you want to change the GitHub token?</Text>
          <Box>
            <Text color={SECONDARY_COLOR}>(</Text>
            <ConfirmInput
              onConfirm={() =>
                setSubStep(chooseNextSubStep({ currentStep: subStep, confirm: true }))
              }
              onCancel={() => handleSubmit(githubToken as string)}
            />
            <Text color={SECONDARY_COLOR}>)</Text>
          </Box>
        </Box>
      </Box>
    )
  } else if (subStep === 'ENTERING_GITHUB_TOKEN') {
    return (
      // Using a key because the input is not re-rendered when the subStep changes
      <Box flexDirection="column">
        <Box key="github-token" flexDirection="row" gap={1}>
          <Text>GitHub token:</Text>
          <Box>
            <Text color={SECONDARY_COLOR}>(</Text>
            <PasswordInput onSubmit={handleSubmit} />
            <Text color={SECONDARY_COLOR}>)</Text>
          </Box>
        </Box>
        <Text>
          You can generate a token at{' '}
          <Text color={PRIMARY_COLOR}>
            https://github.com/settings/tokens/new?scopes=repo&description=pr-splitter-cli
          </Text>
        </Text>
      </Box>
    )
  }
}
