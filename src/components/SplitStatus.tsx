import { Box, Text } from 'ink'
import { ProgressBar, Spinner } from '@inkjs/ui'
import { useAppSelector } from '../redux/hooks'
import { selectSplitProgress } from '../redux/selectors'
import { SUCCESS_COLOR } from './styles'

export const SplitStatus = () => {
  const splitStatus = useAppSelector((state) => state.splitStatus)
  const prInfo = useAppSelector((state) => state.prInfo)
  const localPath = useAppSelector((state) => state.localPath)
  const hunks = useAppSelector((state) => state.hunks)
  const error = useAppSelector((state) => state.error)
  const numHunksGrouped = useAppSelector((state) => state.numHunksGrouped)
  const groupingProgress = useAppSelector((state) => selectSplitProgress(state))
  const refinedHunksGroups = useAppSelector((state) => state.refinedHunksGroups)

  let result = null

  if (splitStatus === 'NOT_STARTED' || splitStatus === 'STARTED') {
    result = (
      <Box gap={1}>
        <Spinner />
        <Text>Starting...</Text>
      </Box>
    )
  }

  if (splitStatus === 'CLONING_REPO') {
    const repoUrl = prInfo ? `${prInfo.owner}/${prInfo.repo}` : 'an unknown repository'
    result = (
      <Box gap={1}>
        <Spinner />
        <Text>Cloning {repoUrl}...</Text>
      </Box>
    )
  }

  if (splitStatus === 'CLONED_REPO') {
    const tempDir = localPath ?? 'an unknown temporary directory'
    const repoUrl = prInfo ? `${prInfo.owner}/${prInfo.repo}` : 'an unknown repository'
    result = (
      <Box gap={1}>
        <Text>
          Cloned {repoUrl} into {tempDir}!
        </Text>
      </Box>
    )
  }

  if (splitStatus === 'PARSED_DIFF') {
    const numHunks = hunks?.length ?? 0
    result = (
      <Box gap={1}>
        <Text>
          Found {numHunks} hunks in the PR #${prInfo?.prNumber}!
        </Text>
      </Box>
    )
  }

  if (splitStatus === 'CREATING_EMBEDDINGS') {
    const numHunks = hunks?.length ?? 0
    result = (
      <Box gap={1}>
        <Spinner />
        <Text>Creating embeddings for {numHunks} hunks...</Text>
      </Box>
    )
  }

  if (splitStatus === 'GROUPING_HUNKS' || splitStatus === 'GROUPED_HUNKS') {
    const numHunks = hunks?.length ?? 0
    result = (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" gap={1}>
          <Spinner />
          <Text>
            Grouped {numHunksGrouped} of {numHunks} hunks...
          </Text>
        </Box>
      </Box>
    )
  }

  if (splitStatus === 'REFINING_GROUPS' || splitStatus === 'REFINED_GROUPS') {
    result = (
      <Box gap={1}>
        <Spinner />
        <Text>Refining groups...</Text>
      </Box>
    )
  }

  if (splitStatus === 'SUCCEEDED') {
    result = (
      <Box gap={1}>
        <Text color={SUCCESS_COLOR}>
          Successfully split pull request into{' '}
          {refinedHunksGroups === null ? 0 : refinedHunksGroups.length} groups!
        </Text>
      </Box>
    )
  }

  if (splitStatus === 'FAILED') {
    result = (
      <Box gap={1}>
        <Text>Failed! Error: {error?.message ?? 'Unknown error'}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      {result}
      <Box width={50}>
        <ProgressBar value={groupingProgress} />
      </Box>
    </Box>
  )
}
