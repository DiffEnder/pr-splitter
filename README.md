# pr-splitter

> Automatically break up large pull requests

<img src="media/pr-splitter-demo.gif" width="688">

## Install

```
npm install -g pr-splitter
```

## Usage

Run `pr-splitter` without arguments to launch the interactive UI that guides you through breaking up a pull request.

<img src="media/screenshot.png" width="350">

## Configuration

To send requests to an LLM, `pr-splitter` asks for the LLM provider, API key, and optionally a custom LLM endpoint.

To perform git operations, `pr-splitter` asks for a GitHub personal access token.

These config values are stored in your system keychain, and requests are sent directy to these services.

## FAQ

**Why?**

Large pull requests are overwhelming and often receive a rubber stamp approval rather than a thorough review.
Small pull requests are easier to review and lead to safer deployments.
We often open large pull requests because breaking up a set of changes into commits that can be reviewed and merged separately is tedious.

**How?**

`pr-splitter` collects all git hunks within a pull request, summarizes each, creates an in-memory vector database of these hunks,
and uses an LLM to group similar hunks together. A new commit is created for each group, and a pull request is created for each commit.

For a more detailed understanding, read the [types.ts](./blob/main/src/types.ts) file and its comments.
There you'll find every type used in the project and its purpose.

## Contributing

Some ways to contribute include:

- [Adding a benchmark](./benchmarks/). This is how we measure the quality of the `pr-splitter`.
- Improving the speed of hunk grouping
- Adding support for missing LLM providers
- Allowing custom split instructions
- Modify the split process to run tests in the repo for each commit it suggests
- Include a command to automatically rebase `PR n +1` after `PR n` is merged
