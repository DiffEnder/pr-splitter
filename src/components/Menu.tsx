import { Select } from '@inkjs/ui'
import { Box, Text } from 'ink'
import { useAppDispatch } from '../redux/hooks'
import { Page, stepChanged } from '../redux/slice'

const OPTIONS: Array<{ label: string; value: Page }> = [
  { label: 'Split pull request', value: 'ADDING_PULL_REQUEST_URL' },
  { label: 'Configure', value: 'ADDING_SECRET_CONFIG' },
]

export const Menu = () => {
  const dispatch = useAppDispatch()
  return (
    <Box flexDirection="column">
      <Text>Select an option:</Text>
      <Select
        options={OPTIONS}
        onChange={(value) => {
          dispatch(stepChanged({ step: value as Page }))
        }}
      />
    </Box>
  )
}
