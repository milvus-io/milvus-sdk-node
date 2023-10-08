# Milvus2-sdk-node

[![typescript](https://badges.aleen42.com/src/typescript.svg)](https://badges.aleen42.com/src/typescript.svg)
[![version](https://img.shields.io/npm/v/@zilliz/milvus2-sdk-node?color=bright-green)](https://img.shields.io/npm/v/@zilliz/milvus2-sdk-node)
[![downloads](https://img.shields.io/npm/dw/@zilliz/milvus2-sdk-node?color=bright-green)](https://img.shields.io/npm/dw/@zilliz/milvus2-sdk-node)
[![codecov](https://codecov.io/gh/milvus-io/milvus-sdk-node/branch/main/graph/badge.svg?token=Zu5FwWstwI)](https://codecov.io/gh/milvus-io/milvus-sdk-node)

The official [Milvus](https://github.com/milvus-io/milvus) client for Node.js.

## Compatibility

The following table shows the recommended `@zilliz/milvus2-sdk-node` versions for different Milvus versions:

| Milvus version | Node sdk version | Installation                        |
| :------------: | :--------------: | :---------------------------------- |
|    v2.2.0+     |    **latest**    | `yarn add @zilliz/milvus2-sdk-node` |

## Dependencies

- [Milvus](https://milvus.io/)
- [Zilliz Cloud](https://cloud.zilliz.com/signup)
- Node: v12+

## Installation

You can use npm (Node package manager) or Yarn to install the `@zilliz/milvus2-sdk-node` dependency in your project:

```shell
npm install @zilliz/milvus2-sdk-node
# or ...
yarn add @zilliz/milvus2-sdk-node
```

This will download the Milvus Node.js client and add a dependency entry in your package.json file.

## Code Examples

### Milvus examples

You can find code examples in the [examples/milvus](./examples/milvus) directory. These examples cover various aspects of working with Milvus, such as connecting to Milvus, vector search, data query, dynamic schema, partition key, and database operations.

### Langchain.js example

You can find a basic langchain.js example in the [examples/langchain](./examples/LangChain) directory.

### next.js example

You can find nextjs app example in the [examples/nextjs](./examples/nextjs) directory.

## Basic usages

This guide will show you how to set up a simple application using Node.js and Milvus. Its scope is only how to set up the node.js client and perform the simple CRUD operations. For more in-depth coverage, see the [Milvus official website](https://milvus.io/).

### Start a Milvus server

```shell
# Download the milvus standalone yaml file
$ wget https://github.com/milvus-io/milvus/releases/latest/download/milvus-standalone-docker-compose.yml -O docker-compose.yml

# start the milvus server
sudo docker-compose up -d
```

### Connect to Milvus

Create a new app.js file and add the following code to try out some basic vector operations using the Milvus node.js client. More details on the [API reference](https://milvus.io/api-reference/node/v2.2.x/Client/MilvusClient.md).

```javascript
import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';

const address = 'your-milvus-ip-with-port';
const username = 'your-milvus-username'; // optional username
const password = 'your-milvus-password'; // optional password

// connect to milvus
const client = new MilvusClient({ address, username, password });
```

### Create a collection

In Milvus, the concept of the collection is like the table in traditional RDBMS, eg: mysql or postgres. Before creating a collection, you need to define a schema, then just call the `createCollection` method.

#### Define schema for collection

A schema defines the fields of a collection, such as the names and data types of the fields that make up the vectors. More details of how to define schema and advanced usage can be found in [API reference](https://milvus.io/api-reference/node/v2.2.x/Collection/createCollection.md).

```javascript
// define schema
const collection_name = `hello_milvus`;
const dim = 128;
const schema = [
  {
    name: 'age',
    description: 'ID field',
    data_type: DataType.Int64,
    is_primary_key: true,
    autoID: true,
  },
  {
    name: 'vector',
    description: 'Vector field',
    data_type: DataType.FloatVector,
    dim: 8,
  },
  { name: 'height', description: 'int64 field', data_type: DataType.Int64 },
  {
    name: 'name',
    description: 'VarChar field',
    data_type: DataType.VarChar,
    max_length: 128,
  },
],
```

#### Create the collection

```javascript
await client.createCollection({
  collection_name,
  fields: schema,
});
```

### Prepare data

The data format utilized by the Milvus Node SDK comprises an array of objects. In each object, the key should correspond to the field `name` defined in the schema. The value type for the key should match the `data_type` specified in the field of the schema.

```javascript
const fields_data = [
  {
    vector: [
      0.11878310581111173, 0.9694947902934701, 0.16443679307243175,
      0.5484226189097237, 0.9839246709011924, 0.5178387104937776,
      0.8716926129208069, 0.5616972243831446,
    ],
    height: 20405,
    name: 'zlnmh',
  },
  {
    vector: [
      0.9992090731236536, 0.8248790611809487, 0.8660083940881405,
      0.09946359318481224, 0.6790698063908669, 0.5013786801063624,
      0.795311915725105, 0.9183033261617566,
    ],
    height: 93773,
    name: '5lr9y',
  },
  {
    vector: [
      0.8761291569818763, 0.07127366044153227, 0.775648976160332,
      0.5619757601304878, 0.6076543120476996, 0.8373907516027586,
      0.8556140171597648, 0.4043893119391049,
    ],
    height: 85122,
    name: 'nes0j',
  },
];
```

### Insert data into collection

Once we have the data, you can insert data into the collection by calling the `insert` method.

```javascript
await client.insert({
  collection_name,
  fields_data,
});
```

### Ceate index

By creating an index and loading the collection into memory, you can improve the performance of search and retrieval operations in Milvus, making it faster and more efficient to work with large-scale datasets.

```javascript
// create index
await client.createIndex({
  // required
  collection_name,
  field_name: 'vector', // optional if you are using milvus v2.2.9+
  index_name: 'myindex', // optional
  index_type: 'HNSW', // optional if you are using milvus v2.2.9+
  params: { efConstruction: 10, M: 4 }, // optional if you are using milvus v2.2.9+
  metric_type: 'L2', // optional if you are using milvus v2.2.9+
});
```

Milvus supports [several different types of indexes](https://milvus.io/docs/index.md), each of which is optimized for different use cases and data distributions. Some of the most commonly used index types in Milvus include IVF_FLAT, IVF_SQ8, IVF_PQ, and HNSW. When creating an index in Milvus, you must choose an appropriate index type based on your specific use case and data distribution.

### Load collection

When you create a collection in Milvus, the collection data is initially stored on disk, and it is not immediately available for search and retrieval. In order to search or retrieve data from the collection, you must first load the collection into memory using the `loadCollectionSync` method.

```javascript
// load collection
await client.loadCollectionSync({
  collection_name,
});
```

### vector search

Now you can perform vector search on your collection.

```javascript
// get the search vector
const searchVector = fields_data[0].vector;

// Perform a vector search on the collection
const res = await client.search({
  // required
  collection_name, // required, the collection name
  vector: searchVector, // required, vector used to compare other vectors in milvus
  // optionals
  filter: 'height > 0', // optional, filter
  params: { nprobe: 64 }, // optional, specify the search parameters
  limit: 10, // optional, specify the number of nearest neighbors to return
  metric_type: 'L2', // optional, metric to calculate similarity of two vectors
  output_fields: ['height', 'name'], // optional, specify the fields to return in the search results
});
```

## Next Steps

- [What is Milvus](https://milvus.io/)
- [Milvus Node SDK API reference](https://milvus.io/api-reference/node/v2.2.x/About.md)
- [Attu, Milvus GUI tool, based on Milvus node.js SDK](https://github.com/zilliztech/attu)
- [Feder, anns index visuliazation tool](https://github.com/zilliztech/feder)

## How to contribute

1. yarn install
2. Fetch milvus proto
   1. `git submodule init` (if this is your first time)
   2. `git submodule update --remote`
3. Add feature in milvus folder.
4. Run test `yarn test -- test/Your-test-for-your-feature.spec.ts`
