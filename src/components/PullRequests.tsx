import { Box, Text } from 'ink'
import { GitHubPullRequestCreateResponse } from '../types'
import { Spinner, UnorderedList } from '@inkjs/ui'

export const PullRequests = ({
  pullRequests,
}: {
  pullRequests: GitHubPullRequestCreateResponse[] | null
}) => {
  if (!pullRequests || pullRequests.length === 0)
    return (
      <Box gap={1}>
        <Text>No pull requests opened</Text>
      </Box>
    )
  return (
    <Box gap={1}>
      <Box flexDirection="column">
        <UnorderedList>
          {pullRequests.map((pr: GitHubPullRequestCreateResponse, i: number) => (
            <UnorderedList.Item key={i}>
              <Text>
                {pr.data.number}: {pr.data.html_url}
              </Text>
            </UnorderedList.Item>
          ))}
        </UnorderedList>
      </Box>
    </Box>
  )
}
