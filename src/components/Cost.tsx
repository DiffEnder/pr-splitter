import { Box, Text } from 'ink'
import { selectTotalCost } from '../redux/selectors'
import { useSelector } from 'react-redux'
import { DISABLED_COLOR } from './styles'

export const Cost = () => {
  const cost = useSelector(selectTotalCost)
  return (
    <Box gap={1}>
      <Text color={DISABLED_COLOR}>Cost: ${cost ? cost.toFixed(2) : '0.00'}</Text>
    </Box>
  )
}
