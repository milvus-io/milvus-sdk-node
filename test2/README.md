# SDK test suite v2

`test2/` is the only SDK test suite. `npm test` and `npm run coverage` run it by default; the legacy `test/` directory has been removed.
`coverage-map.json` records the destination and retention/replacement decision for every original spec.

## Organization

- `unit/`: retained algorithm, golden-vector, request-formatting and mocked-RPC assertions; new HTTP/volume transport and compatibility cases.
- `integration/`: feature-specific database, collection, index, partition, role, resource, search, schema and iterator contracts against Milvus.
- `e2e/`: complete data lifecycles, wide-table vector/primary-key matrices, scalar round trips, gRPC/HTTP interoperability, HTTP-only workflows, backfill, import and telemetry.
- `package/`: built declarations and an actual npm archive, extracted into a temporary consumer project and used for CRUD.
- `cloud/`: explicitly configured external services, excluded from the default local run.
- `fixtures/`: typed schema profiles, fresh field groups, deterministic vector cases, seeded data and storage fixtures.
- `scenarios/`: shared vector, mutation-validation and HTTP lifecycles. Local/native fetch/node-fetch/cloud cases use the same HTTP contract.
- `support/`: diagnostics, managed clients, resource scopes, fetch boundary fixtures and state polling.

## Run locally

```sh
npm run pre
npm run build
npm run test:env:up
npm run coverage
npm run test:env:down
```

The isolated environment defaults to gRPC/HTTP port 29530, telemetry/health port 29091 and MinIO port 9000.
Override `MILVUS_ADDRESS`, `MILVUS_HTTP_ENDPOINT`, `MILVUS_TELEMETRY_API` and `MILVUS_TEST_MINIO_PORT` for an existing environment.
The Docker bindings can be changed with `MILVUS_TEST_GRPC_PORT`, `MILVUS_TEST_HEALTH_PORT` and `MILVUS_TEST_MINIO_PORT`.

Use `test2:unit`, `test2:integration`, `test2:e2e` or `test2:package` for a layer. Unit tests need no running Milvus.
Use `MILVUS_TEST_SEED` to reproduce or explore a dataset. Resource names remain unique across runs.

## PR checks and coverage

Every pull request runs the complete local suite on Node 22, including telemetry and the packaged SDK lifecycle. There are no branch or path filters, and merge-queue checks also run. Nightly runs explore three deterministic seeds.

The workflow starts a fresh Milvus/MinIO deployment matching `package.json.milvusVersion`, then runs the same command available locally:

```sh
npm run test:ci
```

This audits the suite, verifies failure logging and coverage guards, builds the SDK, runs all default tests with coverage, and checks `coverage-baseline.json`. The baseline records the measured coverage of the new suite for each source file. Equal coverage is allowed; regressions in statements, branches, functions or lines are rejected globally and per file. Review baseline updates alongside intentional source/suite changes. Generated protobuf definitions are excluded from both measurements.

Reports are written to `coverage/`. GitHub Actions prints failures and service diagnostics, retains logs and coverage artifacts even on failure, and cleans up services. The required test result does not depend on an external model key or successful Codecov upload. External-service contracts remain opt-in.

Codecov receives Clover, Istanbul JSON and LCOV from the same run, matching main's historical uploader. Uploading only LCOV changes Codecov's source-line and partial-branch mapping, so its project percentage cannot be compared to the historical merged reports. The local gate always compares the four unrounded Istanbul metrics for SDK sources; test helpers and generated protobuf definitions do not contribute to that gate.

The suite uses two Jest workers locally and four in CI on a single runner. Reproduce CI concurrency with `MILVUS_TEST_WORKERS=4 npm run test:ci`. The sequencer schedules E2E lifecycles before shorter specs so small but slow matrix tests do not leave workers idle at the end of a fresh run. Database/collection-isolated contracts run concurrently; `User`, `Resource` and `FlushAll` mutate cluster-wide state and the custom runner completes them in an exclusive serial phase. Tests within each file retain their order. Use `--runInBand` for serial reproduction or `--maxWorkers=1` on memory-constrained machines.

`test2:*` commands remain compatibility aliases; `test:*` and the default Jest configuration all select the same suite. Benchmarks are in `benchmarks/` and are not included in the suite.

## Test contracts

- Wide mixed schemas are first-class regression fixtures. Minimal schemas isolate validation and basic behavior.
- Vector matrices include actual array/byte/typed-array and sparse dictionary/array/CSR/COO representations, both Int64 and VarChar primary keys, single and batched search, updates and deletion.
- Compare query results by primary key. Compare vector round trips against input, with explicit precision for f16/bf16.
- Start a negative case from a valid row and break one property. A missing scalar must not mask a dimension error.
- Distinguish SDK/transport rejection from a returned server failure status. Validate the reason and that no rows were accepted.
- Empty tests and `expect(...)` calls without a matcher fail `test2:audit`. Cleanup and polling failures retain context and the last observed state.
- Retain specialized assertions when they protect behavior beyond a general lifecycle; reuse shared schema, data and client fixtures.

## Environment-dependent coverage

Local telemetry E2E runs by default. Set `MILVUS_TELEMETRY_E2E=false` only when the target lacks that endpoint.
Text-embedding tests require `MILVUS_OPENAI_ENABLED=1` and a server configured with its model-service key.
Authorization-denial contracts live in `cloud/AuthDenial.spec.ts`; the default standalone has authorization disabled and cannot verify access rejection.

`npm run test2:cloud` explicitly runs external contracts. Configure:

- `MILVUS_DEDICATED_ENDPOINT`, `MILVUS_DEDICATED_TOKEN`, optionally `MILVUS_DEDICATED_DATABASE`.
- `MILVUS_SERVERLESS_ENDPOINT`, `MILVUS_SERVERLESS_TOKEN`, optionally `MILVUS_SERVERLESS_DATABASE`.
- `GLOBAL_CLUSTER_ENDPOINT`, `GLOBAL_CLUSTER_TOKEN` for global-cluster scenarios.
- `MILVUS_AUTH_ADDRESS`, `MILVUS_AUTH_TOKEN` (administrator) for an authorization-enabled deployment; the cases create and remove their own test user.

Missing external configuration is reported as skipped. Cloud lifecycle cases create and clean up uniquely named collections.
