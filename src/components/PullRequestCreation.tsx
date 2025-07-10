import { Box, Text } from 'ink'
import { useAppDispatch, useAppSelector } from '../redux/hooks'
import { ConfirmInput, Select, Spinner, TextInput } from '@inkjs/ui'
import { Groups } from './Groups'
import { prCreationStatusChanged, prSplitCompleted, stepChanged } from '../redux/slice'
import { PRIMARY_COLOR } from './styles'
import { closeOriginalPullRequest, createPullRequests } from '../redux/thunks/mainThunks'
import { PullRequests } from './PullRequests'

export const PullRequestCreation = () => {
  const dispatch = useAppDispatch()
  const pullRequests = useAppSelector((state) => state.pullRequests)
  const pr = useAppSelector((state) => state.enhancedPrInfo)
  const status = useAppSelector((state) => state.prCreationStatus)
  const error = useAppSelector((state) => state.error)

  if (status === 'ASKING_FOR_PERMISSION_TO_CREATE_PULL_REQUESTS') return <Groups />

  if (status === 'ASKING_FOR_PERMISSION_TO_CLOSE_ORIGINAL_PULL_REQUEST')
    return (
      <Box flexDirection="column">
        <Text>Pull requests created:</Text>
        <PullRequests pullRequests={pullRequests} />
        <Text color={PRIMARY_COLOR}>Do you want to close the original pull request?</Text>
        <ConfirmInput
          onCancel={() => {
            dispatch(prCreationStatusChanged({ status: 'FINISHED' }))
          }}
          onConfirm={() => {
            dispatch(closeOriginalPullRequest())
          }}
        />
      </Box>
    )

  if (status === 'FINISHED')
    return (
      <Box flexDirection="column">
        <Text>Original pull request closed: {pr?.link}</Text>
        <Text>Pull requests created:</Text>
        <PullRequests pullRequests={pullRequests || []} />
        <TextInput
          placeholder="Press any key to continue"
          onSubmit={() => {
            dispatch(prSplitCompleted())
          }}
        />
      </Box>
    )

  if (status === 'NOT_STARTED')
    return (
      <Box gap={1}>
        <Spinner />
        <Text>Starting...</Text>
      </Box>
    )

  if (status === 'COMMITTED_GROUPS' || status === 'COMMITTING_GROUPS') {
    return (
      <Box gap={1}>
        <Spinner />
        <Text>Committing groups...</Text>
      </Box>
    )
  }

  if (status === 'PUSHING_BRANCHES' || status === 'PUSHED_BRANCHES') {
    return (
      <Box gap={1}>
        <Spinner />
        <Text>{status === 'PUSHING_BRANCHES' ? 'Pushing' : 'Pushed'} branches...</Text>
      </Box>
    )
  }

  if (status === 'CREATING_PULL_REQUESTS' || status === 'CREATED_PULL_REQUESTS') {
    return (
      <Box gap={1}>
        <Spinner />
        <Text>{status === 'CREATING_PULL_REQUESTS' ? 'Creating' : 'Created'} pull requests...</Text>
      </Box>
    )
  }

  if (status === 'CLOSING_ORIGINAL_PULL_REQUEST' || status === 'CLOSED_ORIGINAL_PULL_REQUEST') {
    return (
      <Box gap={1}>
        <Spinner />
        <Text>
          {status === 'CLOSING_ORIGINAL_PULL_REQUEST' ? 'Closing' : 'Closed'} original pull
          request...
        </Text>
      </Box>
    )
  }

  if (status === 'FAILED') {
    return (
      <Box gap={1}>
        <Text>Failed! Error: {error?.message ?? 'Unknown error'}</Text>
      </Box>
    )
  }

  return null
}
