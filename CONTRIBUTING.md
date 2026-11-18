# Contributing to Milvus-sdk-node

We appreciate your interest in contributing to Milvus SDK Node! This document outlines the guidelines and processes you should follow when contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Feature Requests](#feature-requests)
  - [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Releases](#releases)
- [License](#license)

## Code of Conduct

Milvus SDK Node has adopted a Code of Conduct that we expect all contributors to follow. Please read the [code of conduct](CODE_OF_CONDUCT.md) before contributing.

## How to Contribute

### Reporting Bugs

If you find a bug in the code, please report it by opening an issue in the [issue tracker](https://github.com/milvus-io/milvus-sdk-node/issues). Please include a clear and concise description of the problem, along with any steps you took to reproduce it.

### Feature Requests

If you have a feature request, please open an issue in the [issue tracker](https://github.com/milvus-io/milvus-sdk-node/issues). Please include a clear and concise description of the feature you would like to see.

### Pull Requests

1. Create a feature branch from upstream `main`. If `origin` is your fork, use an `upstream` remote for `milvus-io/milvus-sdk-node` as the base. For a direct checkout of the upstream repository:

   ```bash
   git fetch origin main
   git switch -c feat/short-name origin/main
   ```

2. Add tests for the changed behavior under `test2/`. For public API changes, update TypeScript exports, JSDoc, and the relevant docs or examples.
3. Run the relevant tests and format changed SDK files with `npx prettier --write <changed-files>`.
4. Sign off every commit with your configured Git identity. Each commit needs a `Signed-off-by: Name <email>` DCO trailer.

   ```bash
   git commit -s -m 'feat: describe the change'
   git push -u origin HEAD
   ```

5. Open a PR against upstream `main` or the requested maintenance branch. Explain the change, link the related issue, note any server requirements, and list the checks you ran. Check DCO for every commit in the PR and review the CI results.

Your pull request will be reviewed by the maintainers, and we may request changes before merging.

## Development Setup

Here's how you can set up a development environment for Milvus SDK Node:

Use Node.js 22 to match SDK CI, Yarn Classic, and Git. For server-backed tests, install Docker Compose.

```bash
yarn install --frozen-lockfile
npm run pre
npm run build
```

`npm run pre` prepares the pinned `proto/` submodule and its descriptor. If a feature updates the submodule revision, regenerate its SDK definitions with `npm run proto:json` and include them in the same PR.

## Testing

Run `npm run test:unit` for tests that don't need a Milvus server. To run a single spec, pass its path to Jest through the npm script:

```bash
npm test -- --runTestsByPath test2/unit/utils.Schema.spec.ts
```

For server-backed tests and the coverage gate, start the local stack and run the same command as CI:

```bash
MILVUS_VERSION="$(node -p "require('./package.json').milvusVersion")" npm run test:env:up
npm run test:ci
npm run test:env:down
```

Tear down the stack after testing. See the [test suite guide](test2/README.md) for test layers, port configuration, and opt-in cloud tests.

## Releases

The [release guide](.agents/skills/milvus-node-release/SKILL.md) covers the version bump, GitHub Release, npm staging and maintainer approval, and public package verification.

## License

Milvus SDK Node is licensed under the Apache License, Version 2.0. By contributing to this project, you agree to license your contributions under the same license.
