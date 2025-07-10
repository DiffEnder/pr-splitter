# Benchmarks

## Overview

Benchmarks are used to track the quality of the PR splitter over time.

To run the benchmarks use `pnpm benchmarks`. The results will be stored in `benchmark_history/`

## Folder structure

`input/`: the diff of the pull request to split. Created using `git diff <BASE> <HEAD>`
`gold/`: the desired split for each hunk in the order that they should appear. An array of array of hashes of each hunk.

## How to add a new benchmark

1. Choose a pull request
1. Run `git diff ${BASE_BRANCH} ${HEAD_BRANCH} > benchmarks/input/${REPO_NAME}-${PR_NUMBER}.diff`
1. Create a gold file using `npx ts-node generate-hashes.ts <path-to-diff-file>`
1. Open the newly generated `gold/` file and follow the instructions in the comments of the file to group the changes appropriately.

## Metrics

The correctness of the grouping is quantified using pairwise F1-score which focuses on how well `pr-splitter` correctly placed two pairs of hunks that should be within the same group within the same group.

- Idea: Consider each pair of changed hunks in the diff of a pull request.
  - For instance, if the diff contains 4 hunks `h1`, `h2`, `h3`, `h4`, examine all possible pairs like (`h1`, `h2`), (`h1`,`h3`), ..., (`h3`, `h4`)
- True label: whether the two hunks _should_ be grouped together according to a human
- Prediction: whether the two hunks _were_ grouped together by `pr-splitter`
- Results:
  - True Positive (`TP`): the human says the two hunks **should** be grouped together and the `pr-splitter` agrees
  - False Positive (`FP`): the human says the two hunks **should not** be grouped together but the `pr-splitter` grouped them together
  - False Negative (`FN`): the human says the two hunks **should** be grouped together but the `pr-splitter` did not group them together

Then compute precision, recall, and F1-score from `TP`, `FP`, and `FN`.
