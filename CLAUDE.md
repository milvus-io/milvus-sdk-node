# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Node.js SDK for [Milvus](https://milvus.io/) vector database, published as `@zilliz/milvus2-sdk-node`. Requires Node.js v18+.

## Commands

```bash
# Install dependencies
yarn install

# Build (cleans dist/, compiles TS, generates sdk.json)
yarn build

# Run all tests (requires running Milvus instance)
yarn test

# Run a single test file (NODE_ENV=dev is required)
NODE_ENV=dev npx jest test/grpc/SomeTest.spec.ts

# Test coverage
yarn coverage

# Format code
npx prettier --write <file-or-directory>

# Regenerate proto JSON (after proto/ submodule update)
yarn proto:json

# Initialize proto submodule
git submodule update --init --recursive
```

## Architecture

Source code lives in `milvus/` (not `src/`). Build output goes to `dist/`.

### Two Transport Layers

1. **gRPC** (`MilvusClient`) — primary transport with connection pooling, automatic retries, and interceptors
2. **HTTP** (`HttpClient`) — REST alternative for environments where gRPC isn't available

### Class Inheritance Chain (gRPC)

```
BaseClient (proto loading, TLS, auth)
  → User (user/role management)
    → Database (database operations)
      → Collection (collection CRUD)
        → Data (insert/upsert/delete/query/search)
          → Partition (partition management)
            → MilvusIndex (index operations)
              → Resource (resource queries)
                → GRPCClient (channel pool, service init)
                  → MilvusClient (high-level API)
```

Each class in `milvus/grpc/` adds one domain of Milvus operations. `MilvusClient` in `milvus/MilvusClient.ts` is the public entry point that extends `GRPCClient` with simplified high-level methods (aligned with the Python SDK).

### Directory Layout

- `milvus/grpc/` — gRPC client classes (one per domain: Collection, Data, User, etc.)
- `milvus/http/` — HTTP client implementation
- `milvus/types/` — TypeScript type definitions for requests/responses
- `milvus/const/` — Constants, defaults, error codes
- `milvus/utils/` — Utilities (schema building, data formatting, gRPC helpers, validation)
- `milvus/proto-json/` — Generated proto definitions (from `yarn proto:json`)
- `proto/` — Git submodule with upstream Milvus `.proto` files
- `test/grpc/`, `test/http/`, `test/utils/` — Tests organized by transport/domain
- `test/tools/` — Test helpers (collection param generators, data generators)

### Key Patterns

**Adding a new gRPC API method:**
1. If proto has been updated: sync submodule (`git submodule update --init --recursive`) then regenerate JSON (`yarn proto:json`)
2. Define request/response types in `milvus/types/`
3. Implement method in the appropriate `milvus/grpc/` class
4. Wrap gRPC calls with `promisify(this.grpcClient.methodName.bind(this.grpcClient), metadata, timeout)`
5. Check results against `ErrorCode.SUCCESS`
6. Add tests in `test/grpc/`
7. Add JSDoc for public methods (include `@param` and `@returns`)

**Error handling:**
```typescript
if (res.error_code !== ErrorCode.SUCCESS) {
  throw new Error(res.reason);
}
```

**gRPC interceptors** (in `milvus/utils/Grpc.ts`): meta (auth/db_name), retry (exponential backoff), trace (OpenTelemetry), request metadata (timing).

**Connection pooling:** Uses `generic-pool` with configurable min/max (defaults: 5/10).

## Code Style

- TypeScript strict mode, target ES2015, CommonJS modules
- Prettier: 2 spaces, single quotes, semicolons, ES5 trailing commas, avoid arrow parens
- Classes: PascalCase; methods/variables: camelCase; constants: UPPER_CASE
- Test files: `*.spec.ts`
- Tests use `describe`/`it` blocks with `beforeAll`/`afterAll` for setup/cleanup
- Tests are integration tests that connect to a real Milvus instance
