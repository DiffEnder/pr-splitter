import { TextInput } from '@inkjs/ui'
import { Box, Text } from 'ink'
import { useAppDispatch } from '../redux/hooks'
import { splitPullRequest } from '../redux/thunks/mainThunks'
import { PRIMARY_COLOR } from './styles'

export const PrSplit = () => {
  const dispatch = useAppDispatch()
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={PRIMARY_COLOR}>Enter the pull request URL:</Text>
      <TextInput
        placeholder="https://github.com/owner/repo/pull/123"
        onSubmit={(value) => {
          dispatch(splitPullRequest({ prUrl: value }))
        }}
      />
    </Box>
  )
}
