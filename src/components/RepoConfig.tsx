import { TextInput } from '@inkjs/ui'
import { Box, Text } from 'ink'
import { setTestCommandForRepo, splitPullRequest } from '../redux/thunks/mainThunks'
import { useAppDispatch, useAppSelector } from '../redux/hooks'
import { stepChanged } from '../redux/slice'

export const RepoConfig = () => {
  const dispatch = useAppDispatch()
  const prUrl = useAppSelector((state) => state.prUrl)
  const secretConfig = useAppSelector((state) => state.secretConfig)

  if (!prUrl || !secretConfig) return null

  return (
    <Box flexDirection="column">
      <Text>Enter the test command for the repository:</Text>
      <TextInput
        placeholder="npm install && npm test"
        onSubmit={async (value) => {
          await dispatch(setTestCommandForRepo({ testCommand: value })).unwrap()
          if (prUrl) return dispatch(splitPullRequest({ prUrl }))
          dispatch(stepChanged({ step: 'ADDING_PULL_REQUEST_URL' }))
        }}
      />
    </Box>
  )
}
