import { Box, Text } from 'ink'
import { HunkGroup } from '../types'
import { Select } from '@inkjs/ui'
import { useAppDispatch, useAppSelector } from '../redux/hooks'
import { selectGroupOptions } from '../redux/selectors'
import { createPullRequests } from '../redux/thunks/mainThunks'
import { stepChanged, userSelectedHunkGroup } from '../redux/slice'

export const Groups = () => {
  const options = useAppSelector(selectGroupOptions)
  const selectedHunkGroup = useAppSelector((state) => state.selectedHunkGroup)
  const dispatch = useAppDispatch()

  if (selectedHunkGroup) return <HunkReview group={selectedHunkGroup} />

  return (
    <Box flexDirection="column" gap={1}>
      <Text>Suggested pull requests to create:</Text>
      <Select
        options={options}
        onChange={(value) => {
          if (value === 'action_continue') {
            dispatch(createPullRequests())
          } else if (value === 'action_cancel') {
            dispatch(stepChanged({ step: 'MENU' }))
          } else {
            const group = options.find((option) => option.value === value)
            if (group?.group) {
              dispatch(userSelectedHunkGroup({ group: group.group }))
            }
          }
        }}
      />
    </Box>
  )
}

const HunkReview = ({ group }: { group: HunkGroup }) => {
  return (
    <Box flexDirection="column" gap={1}>
      <Text>[Press escape to go back]</Text>
      {group.hunks.map((hunk) => (
        <Box display="flex" flexDirection="column" gap={0} key={hunk.hash}>
          <Box borderColor="blue" padding={0} margin={0}>
            <Text>{hunk.filePath}</Text>
          </Box>
          <Box display="flex" flexDirection="column" borderStyle="single" padding={0}>
            {hunk.content.split('\n').map((line, index) => (
              <Text
                key={`${hunk.hash}-${index}`}
                color={
                  line.startsWith('+') && !line.startsWith('+++')
                    ? 'green'
                    : line.startsWith('-') && !line.startsWith('---')
                    ? 'red'
                    : undefined
                }
              >
                {line}
              </Text>
            ))}
          </Box>
        </Box>
      ))}
      <Text>[Press escape to go back]</Text>
    </Box>
  )
}
