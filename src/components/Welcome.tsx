import { Box, Text } from 'ink'
import { useAppDispatch } from '../redux/hooks'
import { TextInput } from '@inkjs/ui'
import { stepChanged } from '../redux/slice'

export const Welcome = () => {
  const dispatch = useAppDispatch()
  return (
    <Box flexDirection="column">
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text>Welcome to the PR Splitter!</Text>
        </Box>
        <Text>Let's get started by configuring the application to access GitHub and an LLM.</Text>
      </Box>
      <TextInput
        placeholder="Press enter to continue"
        onSubmit={() => {
          dispatch(stepChanged({ step: 'ADDING_SECRET_CONFIG' }))
        }}
      />
    </Box>
  )
}
