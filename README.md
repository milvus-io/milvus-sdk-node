[![typescript](https://badges.aleen42.com/src/typescript.svg)](https://badges.aleen42.com/src/typescript.svg)
[![version](https://img.shields.io/npm/v/@zilliz/milvus2-sdk-node?color=bright-green)](https://img.shields.io/npm/v/@zilliz/milvus2-sdk-node)
[![downloads](https://img.shields.io/npm/dw/@zilliz/milvus2-sdk-node?color=bright-green)](https://img.shields.io/npm/dw/@zilliz/milvus2-sdk-node)
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

- [Milvus](https://milvus.io/)
- [Zilliz Cloud](https://cloud.zilliz.com/signup)
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
$ wget https://github.com/milvus-io/milvus/releases/download/v2.2.8/milvus-standalone-docker-compose.yml -O docker-compose.yml

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
const client = new MilvusClient({ address, ssl, username, password });
```

| Parameters      | Description                                                                                                              | Type    | Example             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------- |
| address         | The Milvus IP address                                                                                                    | String  | '192.168.0.1:19530' |
| ssl?            | SSL connection. It is false by default.                                                                                  | Boolean | false               |
| username?       | The username used to connect to Milvus                                                                                   | String  | milvus              |
| address?        | The password used to connect to Milvus                                                                                   | String  | milvus              |
| maxRetries?     | The number of retries for the grpc method, by default: 3                                                                 | Number  | 3                   |
| retryDelay?     | The delay between attempts at retrying a failed grpc method in ms, by default: 30                                        | Number  | 30                  |
| channelOptions? | an optional configuration object that can be passed to a gRPC client when creating a channel to connect to a gRPC server | Object  |                     |

### define schema for collection

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

In the code, the schema variable is defined as an array of objects, where each object represents a field in the collection. The fields are defined using the following properties:

`name`: The name of the field, which must be unique within the collection.

`description`: A description of the field, which can be used to provide additional information about the field.

`data_type`: The data type of the field, which can be one of several predefined data types such as Int64 or FloatVector.

`is_primary_key`: A boolean flag that indicates whether the field is a primary key. Primary keys are unique identifiers for each vector in the collection, and can be used to efficiently retrieve specific vectors.

`autoID`: A boolean flag that indicates whether the primary key is automatically generated by Milvus.

`dim`: The dimensionality of the vector field. For fields of type FloatVector, this specifies the number of dimensions in each vector.

### create collection

```javascript
await client.createCollection({
  collection_name,
  description: `my first collection`,
  fields: schema,
});
```

### prepare data

When using the Milvus Node SDK to insert data into a collection, it's important to ensure that the data format of the input matches the schema defined for the collection. The data format used by the Milvus Node SDK consists of an array of objects, where each object represents an entity. Typically, each object contains a unique identifier for the entity, which can be an integer or string, and a vector field that stores the feature values as an array of floating-point numbers.

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

Once we have the data, you can insert data into the collection.

```javascript
await client.insert({
  collection_name,
  fields_data,
});
```

### create index

By creating an index and loading the collection into memory, you can improve the performance of search and retrieval operations in Milvus, making it faster and more efficient to work with large-scale datasets.

```javascript
// create index
await client.createIndex({
  collection_name,
  field_name: 'book_intro',
  index_name: 'myindex',
  index_type: 'HNSW',
  params: { efConstruction: 10, M: 4 },
  metric_type: 'L2',
});
```

Milvus supports [several different types of indexes](https://milvus.io/docs/index.md), each of which is optimized for different use cases and data distributions. Some of the most commonly used index types in Milvus include IVF_FLAT, IVF_SQ8, IVF_PQ, and HNSW. When creating an index in Milvus, you must choose an appropriate index type based on your specific use case and data distribution.

`collection_name`: The name of the collection to create the index for.

`field_name`: The name of the field to create the index on.

`index_name`: The name of the index to create.

`index_type`: The type of index to create.

`param`: The index build parameters, please refer to the [index docs](https://milvus.io/docs/index.md).

`metric_type`: The distance metric to use when computing the similarity between vectors. In this case, the metric type is set to L2, which is a commonly used metric for computing the Euclidean distance between vectors.

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
  vector: [0.1, 0.2, 0.3, 0.4], // required, vector used to compare other vectors in milvus
  filter: 'word_count > 0', // optional, filter
  params: { nprobe: 64 }, // optional, specify the search parameters
  limit: 1, // specify the number of nearest neighbors to return
  metric_type: 'L2', // optional, metric to calculate similarity of two vectors
  output_fields: ['book_id', 'word_count'], // optional, specify the fields to return in the search results
});
```

The code snippet performs a vector search on the collection.

First, a random search vector is generated. Then, the `client.search()` method is called with several parameters:
`collection_name`: Required. Specifies the name of the Milvus collection to search.

`vectors`: Required. Specifies the vector used to compare other vectors in Milvus. The example code passes an array of floating-point numbers as the vector.

`filter` or `expr`: Optional. Specifies a filter to apply to the search query. The example code passes a filter that only includes vectors where the word_count field is greater than 0.

`params`: Optional. Specifies additional search parameters. The example code sets nprobe to 64, which controls the number of clusters to search during the query. By default, nothing will be set.

`limit` or `topk`: Optional. Specifies the number of nearest neighbors to return. The example code sets this to 1. By default, it will be `100`

`metric_type`: Optional. Specifies the metric used to calculate the similarity of two vectors. The example code sets this to `"L2"`. By default, it will be `"L2"`.

`output_fields`: Optional. Specifies which fields to include in the search results. The example code specifies the `book_id` and `word_count` fields, by default the node sdk will output all fields.

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
