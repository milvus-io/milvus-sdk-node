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

This guide will show you how to set up a simple application using Node.js and Milvus. Its scope is only how to set up the node.js client and perform the simple CRUD operations. For more in-depth coverage, see the [Milvus offical website](https://milvus.io/).

### Create the package.json file

First, create a directory where your application will live.

```
mkdir myProject
cd myProject
```

Enter the following command and answer the questions to create the initial structure for your new project:

```
npm init -y
```

Next, install this client as a dependency.

```
npm install @zilliz/milvus2-sdk-node
```

### Start a milvus server

```
# Download the milvus standalone yaml file
$ wget https://github.com/milvus-io/milvus/releases/download/v2.2.6/milvus-standalone-docker-compose.yml -O docker-compose.yml

# start the milvus server
sudo docker-compose up -d

```

### Connect to Milvus

Create a new app.js file and add the following code to try out some basic vector operations using the Milvus node.js client.

```
import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";

const IP = 'your-milvus-ip'

// connecting
console.info(`Connecting to DB: ${IP}`);
const client = new MilvusClient(IP);
console.info(`Success!`);

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
    type_params: {
      dim: dim,
    },
  },
];

const test = async () => {
  // create colleciton
  console.time(`Creating example collection: ${collection_name}`);
  console.info(`Schema: `, schema);
  await client.createCollection({
    collection_name,
    description: `my first collection`,
    fields: schema,
  });

  console.timeEnd(`Creating example collection: ${collection_name}`);

 // generate mock data
  const fields_data = [];
  Array(1000)
    .fill(1)
    .forEach(() => {
      let r = {};
      schema.forEach((s) => {
        r = {
          book_id: Math.floor(Math.random() * 100000),
          word_count: Math.floor(Math.random() * 1000),
          book_intro: [...Array(dim)].map(() => Math.random()),
        };
      });
      fields_data.push(r);
    });
  // inserting
  console.time(`Inserting 1000 entities successfully`);
  await client.insert({
    collection_name,
    fields_data,
  });
  console.timeEnd(`Inserting 1000 entities successfully`);

  // create index
  console.time(`Create index successfully`);
  await client.createIndex({
    collection_name,
    field_name: "book_intro",
    index_name: "myindex",
    extra_params: {
      index_type: "AUTOINDEX",
      metric_type: "L2",
    },
  });
  console.timeEnd(`Create index successfully`);
  // load collection
  console.time(`Load Collection successfully`);
  await client.loadCollectionSync({
    collection_name,
  });
  console.timeEnd(`Load Collection successfully`);

  // vector search
  console.time(`Searching vector:`);
  const searchVector = [...Array(dim)].map(() => Math.random());
  const res = await client.search({
    collection_name,
    vectors: [searchVector],
    search_params: {
      anns_field: "book_intro",
      metric_type: "L2",
      params: JSON.stringify({ nprobe: 64 }),
      topk: 1,
    },
    output_fields: ['book_id', 'word_count'],
    vector_type: DataType.FloatVector,
  });
  console.timeEnd(`Searching vector:`);
  console.log(res);
};

test();
```

### Run your app from the command line with:

···
node app.js
···

The application should **print Connected successfully to server to the console**.

## Next Steps

- [What is Milvus](https://milvus.io/).
- [Mivlus node client API reference](https://milvus.io/api-reference/node/v2.2.x/About.md)
- [Attu, Milvus GUI tool, based on Milvus node.js SDK](https://github.com/zilliztech/attu)
- [Feder, anns index visuliazation tool](https://github.com/zilliztech/feder)

## How to contribute

1. yarn install
2. Fetch milvus proto
   1. `git submodule init` (if this is your first time)
   2. `git submodule update --remote`
3. Add feature in milvus folder.
4. Run test `yarn test -- test/Your-test-for-your-feature.spec.ts`
