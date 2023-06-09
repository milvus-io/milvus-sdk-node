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

You can find code examples in the [examples/milvus](./examples/milvus) directory. These examples cover various aspects of working with Milvus, such as connecting to Milvus, vector search, data query, dynamic schema, partition key, and database operations.

## Quick Start

This guide will show you how to set up a simple application using Node.js and Milvus. Its scope is only how to set up the node.js client and perform the simple CRUD operations. For more in-depth coverage, see the [Milvus official website](https://milvus.io/).

### Create the package.json file

First, create a directory where your application will live.

```
mkdir myProject
cd myProject
```

Enter the following command and answer the questions to create the initial structure for your new project:

```shell
npm init -y
```

Next, install this client as a dependency.

```shell
npm install @zilliz/milvus2-sdk-node
```

### Start a Milvus server

```shell
# Download the milvus standalone yaml file
$ wget https://github.com/milvus-io/milvus/releases/latest/download/milvus-standalone-docker-compose.yml -O docker-compose.yml

# start the milvus server
sudo docker-compose up -d
```

### Connect to Milvus

Create a new app.js file and add the following code to try out some basic vector operations using the Milvus node.js client.

```javascript
import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';

const address = 'your-milvus-ip-with-port';
const username = 'your-milvus-username'; // optional username
const password = 'your-milvus-password'; // optional password
const ssl = false; // secure or not

// connect to milvus
const client = new MilvusClient({ address, username, password, ssl });
```

> Starting from v2.2.11+, ssl is no longer needed, we will enable ssl for you if your address starts with `https`;

| Parameters      | Description                                                                                                              | Type    | Example             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------- |
| address         | The Milvus IP address                                                                                                    | String  | '192.168.0.1:19530' |
| ssl?            | SSL connection. It is false by default.                                                                                  | Boolean | false               |
| username?       | The username used to connect to Milvus                                                                                   | String  | username            |
| password?       | The password used to connect to Milvus                                                                                   | String  | password            |
| token?          | Security token, use the form `username:password` as the token                                                            | String  | username:password   |
| database?       | Milvus database                                                                                                          | String  | my-db               |
| maxRetries?     | The number of retries for the grpc method, by default: 3                                                                 | Number  | 3                   |
| retryDelay?     | The delay between attempts at retrying a failed grpc method in ms, by default: 30                                        | Number  | 30                  |
| channelOptions? | an optional configuration object that can be passed to a gRPC client when creating a channel to connect to a gRPC server | Object  |                     |

### Define schema for collection

The code shows an example of how to define a schema for a collection in Milvus using the Milvus Node SDK. A schema defines the properties of a collection, such as the names and data types of the fields that make up the vectors.

```javascript
// define schema
const collection_name = `book`;
const dim = 128;
const schema = [
  {
    name: `book_id`,
    description: `customized primary id`,
    data_type: DataType.Int64,
    is_primary_key: true,
    autoID: false,
  },
  {
    name: `word_count`,
    description: `word count`,
    data_type: DataType.Int64,
  },
  {
    name: `book_intro`,
    description: `word count`,
    data_type: DataType.FloatVector,
    dim: dim,
  },
];
```

### Create a collection

```javascript
await client.createCollection({
  collection_name,
  description: `my first collection`,
  fields: schema,
});
```

### Prepare your data

The data format used by the Milvus Node SDK consists of an array of objects, where each object represents an entity with a unique identifier (integer or string) and a vector field that stores the feature values as an array of floating-point numbers.

```javascript
// generate mock data
const fields_data = [];

// generate mock data
for (let i = 0; i < 1000; i++) {
  // create a new object with random values for each field
  const r = {
    book_id: Math.floor(Math.random() * 100000), // generate a random book ID
    word_count: Math.floor(Math.random() * 1000), // generate a random word count
    book_intro: [...Array(dim)].map(() => Math.random()), // generate a random vector for book_intro
  };
  // add the new object to the fields_data array
  fields_data.push(r);
}
```

### Insert data into collection

Once we have the data, you can insert data into the collection.

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
  field_name: 'book_intro',
  index_name: 'myindex',
  index_type: 'HNSW',
  params: { efConstruction: 10, M: 4 },
  metric_type: 'L2',
});
```

Milvus supports [several different types of indexes](https://milvus.io/docs/index.md), each of which is optimized for different use cases and data distributions. Some of the most commonly used index types in Milvus include IVF_FLAT, IVF_SQ8, IVF_PQ, and HNSW. When creating an index in Milvus, you must choose an appropriate index type based on your specific use case and data distribution.

### load collection

When you create a collection in Milvus, the collection data is initially stored on disk, and it is not immediately available for search and retrieval. In order to search or retrieve data from the collection, you must first load the collection into memory using the loadCollectionSync method.

```javascript
// load collection
await client.loadCollectionSync({
  collection_name,
});
```

### vector search

Now you can perform vector search on your collection.

```javascript
// Generate a random search vector
const searchVector = [...Array(dim)].map(() => Math.random());

// Perform a vector search on the collection
const res = await client.search({
  collection_name, // required, the collection name
  vector: searchVector, // required, vector used to compare other vectors in milvus
  // optionals
  filter: 'word_count > 0', // optional, filter
  params: { nprobe: 64 }, // optional, specify the search parameters
  limit: 10, // optional, specify the number of nearest neighbors to return
  metric_type: 'L2', // optional, metric to calculate similarity of two vectors
  output_fields: ['book_id', 'word_count'], // optional, specify the fields to return in the search results
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
