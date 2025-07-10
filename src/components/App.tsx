import { useEffect } from 'react'
import { Box, Text, TextProps, useInput } from 'ink'
import { Provider } from 'react-redux'
import { store } from '../redux/store'
import { SecretConfig as SecretConfigComponent } from './SecretConfig'
import { PrSplit } from './PrSplit'
import { RepoConfig } from './RepoConfig'
import { init, splitPullRequest, updateSecretConfig } from '../redux/thunks/mainThunks'
import { SplitStatus } from './SplitStatus'
import { useAppDispatch, useAppSelector } from '../redux/hooks'
import { PasswordInput } from '@inkjs/ui'
import { stepChanged } from '../redux/slice'
import { Menu } from './Menu'
import { Welcome } from './Welcome'
import { Cost } from './Cost'
import { PullRequestCreation } from './PullRequestCreation'
import { ERROR_COLOR, SECONDARY_COLOR } from './styles'
import { handleKeyboardInput } from '../redux/thunks/keyboardThunks'

function AppContent() {
  const page = useAppSelector((state) => state.page)
  const prUrl = useAppSelector((state) => state.prUrl)
  const error = useAppSelector((state) => state.error)
  const dispatch = useAppDispatch()

  useInput((input, key) => {
    dispatch(handleKeyboardInput({ input, key }))
  })

  useEffect(() => {
    dispatch(init())
  }, [dispatch])

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color={ERROR_COLOR}>{error.message}</Text>
        <Text color={ERROR_COLOR}>{error.stack}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      {page === 'MENU' && <Menu key="menu" />}

      {page === 'LOADING' && (
        <Text color={SECONDARY_COLOR} key="loading">
          Working…
        </Text>
      )}

      {page === 'WELCOME' && <Welcome key="welcome" />}

      {page === 'ADDING_SECRET_CONFIG' && <SecretConfigComponent key="secret-config" />}

      {page === 'SETTING_GITHUB_TOKEN' && (
        <Box flexDirection="column" key="setting-github-token">
          <Text color={ERROR_COLOR}>Your GitHub token is invalid. Please enter a valid token.</Text>
          <PasswordInput
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            onSubmit={async (value: string) => {
              await dispatch(updateSecretConfig({ githubToken: value })).unwrap()
              // We don't want to ask for the pull request URL again if it's already set
              if (prUrl) return dispatch(splitPullRequest({ prUrl }))
              dispatch(stepChanged({ step: 'ADDING_PULL_REQUEST_URL' }))
            }}
          />
        </Box>
      )}

      {page === 'SETTING_LLM_API_KEY' && (
        <Box key="api-key" flexDirection="row" gap={1}>
          <Text>LLM API key:</Text>
          <Box>
            <Text color={SECONDARY_COLOR}>(</Text>
            <PasswordInput
              onSubmit={async (value: string) => {
                await dispatch(updateSecretConfig({ apiKey: value })).unwrap()
                // We don't want to ask for the pull request URL again if it's already set
                if (prUrl) return dispatch(splitPullRequest({ prUrl }))
                dispatch(stepChanged({ step: 'ADDING_PULL_REQUEST_URL' }))
              }}
            />
            <Text color={SECONDARY_COLOR}>)</Text>
          </Box>
        </Box>
      )}

      {page === 'ADDING_PULL_REQUEST_URL' && <PrSplit key="pr-split" />}

      {page === 'ADDING_REPO_TEST_COMMAND' && <RepoConfig key="repo-config" />}

      {page === 'SPLITTING_PULL_REQUEST' && <SplitStatus key="split-status" />}

      {page === 'SPLITTING_PULL_REQUEST' && <Cost key="cost" />}

      {page === 'CREATING_PULL_REQUESTS' && <PullRequestCreation key="pull-request-creation" />}
    </Box>
  )
}

export default function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  )
}
