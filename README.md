# Milvus2-sdk-node

[![typescript](https://badges.aleen42.com/src/typescript.svg)](https://badges.aleen42.com/src/typescript.svg)
[![version](https://img.shields.io/npm/v/@zilliz/milvus2-sdk-node?color=bright-green)](https://github.com/zilliztech/attu/releases)
[![downloads](https://img.shields.io/npm/dw/@zilliz/milvus2-sdk-node?color=bright-green)](https://www.npmjs.com/package/@zilliz/milvus2-sdk-node)
[![codecov](https://codecov.io/gh/milvus-io/milvus-sdk-node/branch/main/graph/badge.svg?token=Zu5FwWstwI)](https://codecov.io/gh/milvus-io/milvus-sdk-node)

The official [Milvus](https://github.com/milvus-io/milvus) client for Node.js.

## 📚 Documentation

**👉 [View Full Documentation](https://milvus-io.github.io/milvus-sdk-node)**

For complete documentation, API reference, guides, and examples, please visit our documentation site.

## Compatibility

The following table shows the recommended `@zilliz/milvus2-sdk-node` versions for different Milvus versions:

| Milvus version | Node sdk version | Installation                               |
| :------------: | :--------------: | :----------------------------------------- |
|    v2.6.0+     |    **latest**    | `yarn add @zilliz/milvus2-sdk-node@latest` |
|    v2.5.0+     |      v2.5.0      | `yarn add @zilliz/milvus2-sdk-node@2.5.12` |
|    v2.4.0+     |      v2.4.9      | `yarn add @zilliz/milvus2-sdk-node@2.4.9`  |
|    v2.3.0+     |      v2.3.5      | `yarn add @zilliz/milvus2-sdk-node@2.3.5`  |
|    v2.2.0+     |      v2.3.5      | `yarn add @zilliz/milvus2-sdk-node@2.3.5`  |

## Dependencies

- [Milvus](https://milvus.io/)
- [Zilliz Cloud](https://cloud.zilliz.com/signup)
- Node: v18+

## Installation

```shell
npm install @zilliz/milvus2-sdk-node
# or
yarn add @zilliz/milvus2-sdk-node
```

## Quick Start

```javascript
import { MilvusClient } from '@zilliz/milvus2-sdk-node';

const client = new MilvusClient({
  address: 'localhost:19530',
});

await client.connectPromise;
```

For more examples and detailed usage, see the [documentation](https://milvus-io.github.io/milvus-sdk-node).

## Contributing

1. `yarn install`
2. Fetch milvus proto
   - `git submodule init` (if this is your first time)
   - `git submodule update --remote`
3. Add feature in milvus folder
4. Run test `yarn test -- test/Your-test-for-your-feature.spec.ts`

## Links

- [Documentation](https://milvus-io.github.io/milvus-sdk-node)
- [Milvus Official Website](https://milvus.io/)
- [GitHub Repository](https://github.com/milvus-io/milvus-sdk-node)
