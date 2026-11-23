# Milvus Node.js SDK contributor guide

The npm package is `@zilliz/milvus2-sdk-node`. Run commands from the repository root unless a command specifies another directory.

## Where to work

- `milvus/MilvusClient.ts` and `milvus/HttpClient.ts` are the public client entry points. Domain implementations live under `milvus/grpc/` and `milvus/http/`. Request and response types live under `milvus/types/`. Check `milvus/index.ts` and the relevant index files when adding public exports.
- `proto/` pins the upstream Milvus protobuf submodule. `milvus/proto-json/` contains generated definitions. `dist/` is build output.
- `test2/` contains the SDK tests. `examples/` contains consumer examples, `benchmarks/` contains manual benchmarks, and `docs/src/content/docs/` contains the documentation site.

## Submit a feature or fix

1. Branch from the current upstream `main` unless the task targets a maintenance branch. Use a fork when upstream push access is unavailable. Check the behavior you're changing with a focused baseline test when practical.
2. Implement the change in the relevant client or domain module. Follow the adjacent RPC, validation, and status-handling patterns. Preserve existing request and response behavior, and state any new server version or feature requirements.
3. Add coverage in the test layer that observes the change. For a public API change, update its TypeScript exports, JSDoc, and the relevant guide or example. Keep strict TypeScript and follow [.prettierrc](.prettierrc). Format changed SDK files with `npx prettier --write <changed-files>`.
   For StructArray changes, follow the [required StructArray test matrix](test2/README.md#structarray-regression-matrix). Collection creation, adding a whole StructArray, and adding a `parent[child]` sub-field use distinct request paths: coverage of one does not cover the others. Verify serialized requests and run the affected real-server lifecycles before submitting; report any unverified matrix cells and server version explicitly.
4. Commit with `git commit -s` using your configured identity. Every commit in a PR needs a valid `Signed-off-by: Name <email>` trailer. Before pushing or updating the PR, check the entire range against the actual upstream base. For an `origin/main` base, run the following command. Fix missing trailers on your own commits and use `--force-with-lease` for a necessary rewrite of your pushed branch.

   ```bash
   git log --format='%h %s%n%(trailers:key=Signed-off-by,valueonly)' origin/main..HEAD
   ```

5. Open a PR against the intended base. Explain the user-facing behavior, link the issue if applicable, note server compatibility, and report the checks you ran and any relevant checks you skipped. Review the DCO and SDK CI results before merging.

## Build and test

Use Node.js 22 to match [SDK CI](.github/workflows/test.yml) and Yarn Classic with the checked-in lockfile. From a fresh checkout:

```bash
yarn install --frozen-lockfile
npm run pre
npm run build
```

`npm run pre` initializes the pinned submodule and installs the Protobuf descriptor. If the submodule revision changes, run `npm run pre` followed by `npm run proto:json`, then include the gitlink and generated changes in the same PR. Build output includes the SDK's declarations and `dist/sdk.json`, which reads the SDK and target server versions from `package.json`.

| What to verify                 | Command                                                                    | Environment                                 |
| ------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------- |
| SDK logic and mocked RPCs      | `npm run test:unit`                                                        | No Milvus required                          |
| A single spec                  | `npm test -- --runTestsByPath test2/unit/utils.Schema.spec.ts --runInBand` | Match the spec's dependencies               |
| Server contracts               | `npm run test:integration`                                                 | Milvus, plus storage where the tests use it |
| End-to-end lifecycles          | `npm run test:e2e`                                                         | Local test stack                            |
| Built package and declarations | `npm run build-test`                                                       | Local test stack                            |
| CI suite and coverage gate     | `npm run test:ci`                                                          | Local test stack                            |
| External cloud contracts       | `npm run test-cloud`                                                       | Opt-in endpoints and credentials            |

For local server-backed tests, use Docker Compose and the server version in `package.json`:

```bash
MILVUS_VERSION="$(node -p "require('./package.json').milvusVersion")" npm run test:env:up
npm run test:ci
npm run test:env:down
```

Tear down the test stack you started even if testing fails. Local defaults are Milvus on `127.0.0.1:29530`, health and telemetry on port `29091`, and MinIO on port `9000`. Keep the SDK test endpoints and Compose bindings aligned when overriding ports. The npm test scripts set `NODE_ENV=dev`. Set it yourself if running Jest directly.

CI builds the SDK, runs the suite and package lifecycle with coverage, and checks the global and per-file baseline. Reuse `test2/fixtures/` and `test2/support/` for isolated resources and cleanup. See the [test suite guide](test2/README.md) for seeds, coverage, Docker overrides, and cloud setup.

## Release the SDK

The maintainer workflow is documented in the [milvus-node-release skill](.agents/skills/milvus-node-release/SKILL.md). Prepare and merge the version bump, then publish the matching GitHub Release. The [release workflow](.github/workflows/release.yml) builds on Node.js 24, publishes directly to npm through OIDC Trusted Publishing, and verifies the exact version and dist-tag on the public registry. Use staged publishing only when explicitly requested; it adds a separate maintainer approval step.

For documentation-site edits, install its dependencies using the [site build instructions](docs/src/content/docs/reference/contributing.mdx#build-and-preview-the-documentation-site). Format MDX with `yarn --cwd docs prettier --write src/content/docs/<file>.mdx` so Prettier can load the Astro plugin.
