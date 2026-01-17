# Agentic Coding Guidelines

This document provides essential instructions for AI agents operating within the `milvus-sdk-node` repository.

## 1. Project Overview & Structure
- **Root Directory:** `/Users/ryjiang/workspace/milvus-sdk-node`
- **Source Code:** `milvus/` (Top-level source directory, not `src/`)
- **Tests:** `test/` (Subdirectories: `grpc`, `http`, `utils`, `build`)
- **Build Output:** `dist/`
- **Dependencies:** Managed via `yarn`.

## 2. Build, Test, and Lint Commands

### Build
- **Full Build:** `npm run build`
  - Cleans `dist/`, compiles TypeScript with declarations, and runs `build.js`.

### Testing (Jest)
- **Run All Tests:** `npm test`
- **Run a Single Test File:**
  ```bash
  NODE_ENV=dev npx jest test/grpc/YourTestFile.spec.ts
  ```
  *Note: Always set `NODE_ENV=dev` to ensure correct configuration.*
- **Run Tests with Coverage:** `npm run coverage`
- **Test Configuration:** `jest.config.js` uses `ts-jest`.

### Linting & Formatting
- **Formatter:** Prettier is used. Configuration in `.prettierrc`.
  - Check formatting: `npx prettier --check .`
  - Fix formatting: `npx prettier --write .`
- **Linting:** No explicit `lint` script in `package.json`. Follow existing code style strictly.

## 3. Code Style & Conventions

### General
- **Language:** TypeScript (Target `ES2015`, CommonJS modules).
- **Strictness:** `strict: true` in `tsconfig.json`. Ensure no implicit `any`.

### Formatting (Prettier Rules)
- **Indentation:** 2 spaces.
- **Quotes:** Single quotes (`'`).
- **Semicolons:** Yes (`semi: true`).
- **Trailing Commas:** ES5 (`trailingComma: "es5"`).
- **Bracket Spacing:** Yes (`bracketSpacing: true`).
- **Arrow Parens:** Avoid (`arrowParens: "avoid"`).

### Naming Conventions
- **Classes:** `PascalCase` (e.g., `MilvusClient`, `GRPCClient`).
- **Methods & Variables:** `camelCase` (e.g., `createCollection`, `indexParams`).
- **Constants:** `UPPER_CASE` (e.g., `DEFAULT_PRIMARY_KEY_FIELD`, `ERROR_REASONS`).
- **Filenames:** Match the primary class/module name (e.g., `MilvusClient.ts`, `DataType.ts`). Tests follow `*.spec.ts`.

### Imports
- Use absolute imports or relative imports consistent with existing files.
- In tests, import from the SDK root or specific submodules as seen in examples:
  ```typescript
  import { MilvusClient } from '../../milvus';
  ```

### Error Handling
- Use `async/await` pattern.
- Throw `Error` objects with descriptive messages or specific error codes.
- Check operation results against `ErrorCode.SUCCESS`:
  ```typescript
  if (res.error_code !== ErrorCode.SUCCESS) {
    throw new Error(res.reason);
  }
  ```

### Documentation
- Use JSDoc for public methods and classes.
- Include `@param` and `@returns` tags.

## 4. Development Workflow for Agents
1.  **Analyze:** Read `package.json` and related source files (`milvus/`) to understand context.
2.  **Verify:** Before editing, run relevant tests to establish a baseline.
3.  **Edit:** Make changes ensuring strict type safety and adherence to style.
4.  **Test:** Run specific tests for the modified module. Create new tests in `test/` if adding features.
5.  **Format:** Run `npx prettier --write <file>` on changed files.

## 5. Specific Rules
- **No `src` folder:** Source code lives in `milvus/`.
- **Proto Files:** Protocol buffers are in `proto/`.
- **Environment:** Node.js environment.

## 6. Testing Guidelines
- Use `describe` blocks to group tests by class or functionality.
- Use `it` blocks for specific test cases.
- Mock external dependencies where appropriate, but integration tests (connecting to a mock or real Milvus instance) are common in this repo.
- Clean up resources (e.g., close connections) in `afterAll`.

## 7. Configuration Files
- `package.json`: Scripts and dependencies.
- `tsconfig.json`: TypeScript compiler options.
- `jest.config.js`: Test runner configuration.
- `.prettierrc`: Code formatting rules.
