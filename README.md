[![typescript](https://badges.aleen42.com/src/typescript.svg)](https://badges.aleen42.com/src/typescript.svg)
[![version](https://img.shields.io/npm/v/@zilliz/milvus2-sdk-node)](https://img.shields.io/npm/v/@zilliz/milvus2-sdk-node)
[![downloads](https://img.shields.io/npm/dw/@zilliz/milvus2-sdk-node)](https://img.shields.io/npm/dw/@zilliz/milvus2-sdk-node)
[![codecov](https://codecov.io/gh/milvus-io/milvus-sdk-node/branch/main/graph/badge.svg?token=Zu5FwWstwI)](https://codecov.io/gh/milvus-io/milvus-sdk-node)

# Milvus2-sdk-node

The official [Milvus](https://github.com/milvus-io/milvus) client for Node.js.

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

The recommended way to get started using the Milvus node.js client is by using npm (Node package manager) to install the dependency in your project.

```javascript
npm install @zilliz/milvus2-sdk-node
# or ...
yarn add @zilliz/milvus2-sdk-node
```

This will download the Milvus node.js client and add a dependency entry in your package.json file.

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

### Start a milvus server

```shell
# Download the milvus standalone yaml file
$ wget https://github.com/milvus-io/milvus/releases/download/v2.2.6/milvus-standalone-docker-compose.yml -O docker-compose.yml

# start the milvus server
sudo docker-compose up -d
```

### Connect to Milvus

Create a new app.js file and add the following code to try out some basic vector operations using the Milvus node.js client.

```javascript
import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';

const IP = 'your-milvus-ip';

// connect to milvus
const client = new MilvusClient(IP);
```

### define schema for collection

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

### create collection

```javascript
await client.createCollection({
  collection_name,
  description: `my first collection`,
  fields: schema,
});
```

### prepare data

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

### insert data into collection

```javascript
await client.insert({
  collection_name,
  fields_data,
});
```

### create index and load collection into memory

```javascript
// create index
await client.createIndex({
  collection_name,
  field_name: 'book_intro',
  index_name: 'myindex',
  index_type: 'IVF_FLAT',
  metric_type: 'L2',
});
// load collection
await client.loadCollectionSync({
  collection_name,
});
```

### vector search

```javascript
// Generate a random search vector
const searchVector = [...Array(dim)].map(() => Math.random());

// Perform a vector search on the collection
const res = await client.search({
  collection_name,
  vectors: [searchVector],
  filter: 'word_count > 0', // optional, filter
  params: { nprobe: 64 }, // optional, specify the search parameters
  limit: 1, // specify the number of nearest neighbors to return
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
