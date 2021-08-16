[![typescript](https://badges.aleen42.com/src/typescript.svg)](https://badges.aleen42.com/src/typescript.svg)
[![downloads](https://img.shields.io/npm/dw/@zilliz/milvus2-sdk-node)](https://img.shields.io/npm/dw/@zilliz/milvus2-sdk-node)
[![codecov](https://codecov.io/gh/milvus-io/milvus-sdk-node/branch/v2.x/graph/badge.svg?token=Zu5FwWstwI)](https://codecov.io/gh/milvus-io/milvus-sdk-node)

# Milvus2-sdk-node

This is node sdk for [Milvus](https://github.com/milvus-io/milvus).

## Dependencies

Milvus: v2+

Node: v12+

## Installation

```javascript
   npm install @zilliz/milvus2-sdk-node
```

## API

| Name                    | Async |               Description                |
| :---------------------- | :---- | :--------------------------------------: |
| createCollection        | false |       Create collection in milvus        |
| hasCollection           | false |      Check collection exist or not       |
| showCollections         | false |           List all collections           |
| describeCollection      | false | Get collection detail, like name ,schema |
| getCollectionStatistics | false | Get collection statistics like row count |
| loadCollection          | true  |           Load data into cache           |
| releaseCollection       | true  |         Release data from cache          |
| dropCollection          | false |       Drop collection from milvus        |
| createPartition         | false |    Create partition in one collection    |
| hasPartition            | false |       Check partition exist or not       |
| showPartitions          | false |  List all partitions for one collection  |
| getPartitionStatistics  | false | Get partition statistics like row_count  |
| loadPartitions          | true  |           Load data into cache           |
| releasePartitions       | true  |         Release data from cache          |
| dropPartition           | false |        Drop partition from milvus        |
| createIndex             | true  |       Creat index on vector field        |
| describeIndex           | false |              Get index info              |
| getIndexState           | false |          Get index build state           |
| getIndexBuildProgress   | false |       Get index building progress        |
| dropIndex               | true  |                Drop index                |
| insert                  | false |         Insert data into milvus          |
| search                  | false |         Vector similarity search         |
| flush                   | false |                Flush Data                |
| query                   | false |             Get data by expr             |

## Example

1. [How to operate collection](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/Collection.ts)
2. [How to insert data](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/Insert.ts)
3. [Vector similarity search on float field](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/Search.ts)
4. [Vector similarity search on binary field](https://github.com/milvus-io/milvus-sdk-node/blob/main/example/BinarySearch.ts)
