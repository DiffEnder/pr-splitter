export const computeF1 = ({
  gold,
  prediction,
}: {
  gold: Array<Array<string>>
  prediction: Array<Array<string>>
}) => {
  const all = Array.from(new Set([...gold.flat(), ...prediction.flat()]))
  const combos: Array<{ a: string; b: string }> = []
  const combosSoFar: Set<string> = new Set()
  all.forEach((a, i) => {
    all.forEach((b, j) => {
      // Can't combine the same hunks together
      if (i === j) return
      // The order of pairs don't matter so ensure that we don't add the pair twice
      const comboAsString = [a, b].sort().join(' ')
      if (combosSoFar.has(comboAsString)) return
      combos.push({ a, b })
      combosSoFar.add(comboAsString)
    })
  })

  // Compute true positive, false positive, false negative
  const { tp, fp, fn } = combos.reduce(
    ({ tp, fp, fn }, { a, b }) => {
      const predicted = areSameGroup({ groups: prediction, a, b })
      const actual = areSameGroup({ groups: gold, a, b })
      return {
        tp: tp + (predicted && actual ? 1 : 0),
        fp: fp + (predicted && !actual ? 1 : 0),
        fn: fn + (!predicted && actual ? 1 : 0),
      }
    },
    { tp: 0, fp: 0, fn: 0 },
  )
  const precision = tp / (tp + fp)
  const recall = tp / (tp + fn)
  return (2 * (precision * recall)) / (precision + recall)
}

const areSameGroup = ({ groups, a, b }: { groups: Array<Array<string>>; a: string; b: string }) => {
  const aIndex = groups.findIndex((g) => g.findIndex((hash) => hash === a) > -1)
  const bIndex = groups.findIndex((g) => g.findIndex((hash) => hash === b) > -1)
  return aIndex === bIndex
}
