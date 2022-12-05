[![typescript](https://badges.aleen42.com/src/typescript.svg)](https://badges.aleen42.com/src/typescript.svg)
[![version](https://img.shields.io/npm/v/@zilliz/milvus2-sdk-node)](https://img.shields.io/npm/v/@zilliz/milvus2-sdk-node)
[![downloads](https://img.shields.io/npm/dw/@zilliz/milvus2-sdk-node)](https://img.shields.io/npm/dw/@zilliz/milvus2-sdk-node)
[![codecov](https://codecov.io/gh/milvus-io/milvus-sdk-node/branch/main/graph/badge.svg?token=Zu5FwWstwI)](https://codecov.io/gh/milvus-io/milvus-sdk-node)

# Milvus2-sdk-node

Node.js sdk for [Milvus](https://github.com/milvus-io/milvus).

## Compatibility

The following collection shows Milvus versions and recommended @zilliz/milvus2-sdk-node versions:

| Milvus version | Recommended @zilliz/milvus2-sdk-node version |
| :------------: | :------------------------------------------: |
|     2.2.x      |                    2.2.x                     |
|     2.1.x      |                    2.1.x                     |
|     2.0.1      |                 2.0.0, 2.0.1                 |
|     2.0.0      |                    2.0.0                     |

## Dependencies

- Milvus: v2+
- Node: v12+

## Installation

```javascript
npm install @zilliz/milvus2-sdk-node
```

## SDK

- [Client](./milvus/Index.ts)
- [Collection](./milvus/Collection.ts)
- [Index](./milvus/MilvusIndex.ts)
  - [FLAT](https://github.com/milvus-io/milvus-sdk-node/blob/main/test/Index.spec.ts#L63)
  - [IVF_FLAT](https://github.com/milvus-io/milvus-sdk-node/blob/main/test/Index.spec.ts#L76)
  - [IVF_SQ8](https://github.com/milvus-io/milvus-sdk-node/blob/main/test/Index.spec.ts#L91)
  - [IVF_PQ](https://github.com/milvus-io/milvus-sdk-node/blob/main/test/Index.spec.ts#L106)
  - [HNSW](https://github.com/milvus-io/milvus-sdk-node/blob/main/test/Index.spec.ts#L121)
  - [ANNOY](https://github.com/milvus-io/milvus-sdk-node/blob/main/test/Index.spec.ts#L136)
  - DISKANN (not supported yet)
- [Partition](./milvus/Partition.ts)
- [User](./milvus/User.ts)
- [Utils](./milvus/Utils.ts)
- [Data](./milvus/Data.ts)

More documentation, you can refer [Milvus offical website](https://milvus.io/).

## Example

1. [Hello World](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/HelloMilvus.ts)
2. [How to operate collection](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/Collection.ts)
3. [How to insert data](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/Insert.ts)
4. [Vector similarity search on float field](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/Search.ts)
5. [Vector similarity search on binary field](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/BinarySearch.ts)

## How to contribute

1. yarn install
2. Fetch milvus proto
   1. `git submodule init` (if this is your first time)
   2. `git submodule update --remote`
3. Add feature in milvus folder.
4. Run test `yarn test -- test/Your-test-for-your-feature.spec.ts`

## Others

- [Attu](https://github.com/zilliztech/attu) which is a Milvus web interface tool, depends on Milvus node.js SDK.
- [Feder](https://github.com/zilliztech/feder) which is a visualization tool for visualize hnsw, faiss and other index.
