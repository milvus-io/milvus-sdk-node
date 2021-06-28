[![license](https://img.shields.io/hexpm/l/plug.svg?color=green)](https://github.com/milvus-io/pymilvus/blob/master/LICENSE)
[![typescript](https://badges.aleen42.com/src/typescript.svg)](https://badges.aleen42.com/src/typescript.svg)
[![downloads](https://img.shields.io/npm/dw/@zilliz/milvus-sdk-node)](https://img.shields.io/npm/dw/@zilliz/milvus-sdk-node)
[![codecov](https://codecov.io/gh/milvus-io/milvus-sdk-node/branch/v2.x/graph/badge.svg?token=Zu5FwWstwI)](https://codecov.io/gh/milvus-io/milvus-sdk-node)

# Milvus-sdk-node

This is a basic introduction to Milvus by milvus-sdk-node.
The all functions will return a promise, so we can use async await to get the result.

## Dependencies

Milvus: v2.x
Node: v12+

## Installation

```javascript
   npm install @zilliz/milvus2-sdk-node
```

<!-- ## Example

Here we use float vectors as example vector field data, if you want to learn example about binary vectors, see xxx -->

## Prerequisites

Before we start, there are some prerequisites.

Make sure that:

- You have a running Milvus instance.
- @zilliz/milvus2-sdk-node is correctly installed.

## Connect to Milvus

1. First of all, we need to import @zilliz/milvus-sdk-node.

```javascript
import { MilvusNode } from "@zilliz/milvus2-sdk-node";
```

2. Then, we can make connection with Milvus server.
   By default Milvus runs on localhost in port 19530, so you can use default value to connect to Milvus.

```javascript
const IP = "127.0.0.1:19530";
const milvusClient = new MilvusNode(IP);
```

3. After connecting, we can communicate with Milvus in the following ways.
   If you are confused about the terminology, see [Milvus Terminology](https://milvus.io/docs/terms.md) for explanations.

## Collection

Now let's create a new collection. Before we start, we can list all the collections already exist. For a brand new Milvus running instance, the result should be empty.

```javascript
const collections = await milvusClient.showCollections();
// return data
// {
//   collection_names: [ 'test_01' ],
//   status: { error_code: 'SUCCESS', reason: 'OK' }
// }
```

## Create Collection

To create collection, we need to provide collection parameters.
`CollectionSchema` consists of 4 components, they are `collection_name`, `dimension`, `index_file_size` and `metric_type`.

1. collection_name:
   The name of collection should be a unique string to collections already exist.

2. dimension:
   For a float vector, dimension should be equal to the length of a vector; for a binary vector, dimension should be equal to bit size of a vector.

3. index_file_size:
   Milvus controls the size of data segment according to the `index_file_size`, you can refer to [Storage Concepts](https://milvus.io/docs/storage_concept.md) for more information about `segments` and `index_file_size`.

4. metric_type:
   We can use getMetricType function to get all metricTypes.
   Milvus compute distance between two vectors, you can refer to [Distance Metrics](https://milvus.io/docs/metric.md) for more information.

Now we can create a collection:

```javascript
const res = await milvusClient.createCollection({
  collection_name: "demo_milvus_tutorial",
  description: "Collection desc",
  fields: [
    {
      name: "vector_01",
      description: "vector field",
      data_type: DataType.FloatVector,
      type_params: [
        {
          key: "dim",
          value: "128",
        },
      ],
    },
    {
      name: "age",
      description: "",
      data_type: DataType.Int64,
      is_primary_key: true,
      autoID: false,
    },
  ],
});
// { error_code: 'SUCCESS', reason: 'OK' }
```

Then you can list collections and 'demo_film_tutorial' will be in the result.

You can also get info of the collection.

```javascript
const collectionInfo = await milvusClient.describeCollection({
  collection_name: COLLECTION_NAME,
});
// {
//   status: { error_code: 'Success', reason: '' },
//   schema: {
//     fields: [ [Object], [Object] ],
//     name: COLLECTION_NAME,
//     description: 'Collection desc',
//     autoID: false -> not useful
//   },
//   collectionID: '425948843570364417'
// }
```

This tutorial is a basic intro tutorial, building index won't be covered by this tutorial.

Further more, if you want to get a thorough view of indexes, check our official website for [Vector Index](https://milvus.io/docs/index.md).

## Create Partition

If you don't create a partition, there will be a default one called "`_default`", all the entities will be inserted into the "`_default`" partition. You can check it by `list_partitions

```javascript
const partitions = await milvusClient.showPartitions({
  collection_name: COLLECTION_NAME,
});
// {
//     partition_names: [ '_default' ],
//     partitionIDs: [ '425948937832366082' ],
//     status: { error_code: 'Success', reason: '' }
//   }
```

You can provide a partition tag to create a new partition.

```javascript
const res = await milvusClient.createPartition({
  collection_name: COLLECTION_NAME,
  tag: PARTITION_TAG,
});
// { error_code: 'SUCCESS', reason: 'OK' }
```

## Deletion

Finally, let's move on to deletion in Milvus.
We can delete entities by ids, drop a whole partition, or drop the entire collection.

## Drop a Partition

You can also drop a partition.

### Danger

Once you drop a partition, all the data in this partition will be deleted too.

```javascript
const res = await milvusClient.dropPartition({
  collection_name: COLLECTION_NAME,
  partition_name: PARTITION_TAG,
});
// { error_code: 'SUCCESS', reason: 'OK' }
```

## Drop a Collection

Finally, you can drop an entire collection.

### Danger

Once you drop a collection, all the data in this collection will be deleted too.

```javascript
await milvusClient.dropCollection({
  collection_name: COLLECTION_NAME,
});
// { error_code: 'SUCCESS', reason: 'OK' }
```
