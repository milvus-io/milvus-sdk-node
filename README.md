# Tutorial

This is a basic introduction to Milvus by Milvus-Node-SDK.

## Dependencies

Milvus: v1.0.0
Node: v14+

## Installation

```javascript
   npm install milvus-node-sdk
```

## Example

Here we use float vectors as example vector field data, if you want to learn example about binary vectors, see xxx

## Prerequisites

Before we start, there are some prerequisites.

Make sure that:

- You have a running Milvus instance.
- Milvus-Node-SDK is correctly installed.

## Connect to Milvus

1. First of all, we need to import Milvus-Node-Sk.

```javascript
import { MilvusNode } from "milvus-test-nodes";
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
console.log("--- collections ---", collections);
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
const metricTypes = milvusClient.getMetricType();
const res = await milvusClient.createCollection({
  collection_name: "demo_milvus_tutorial",
  dimension: 8,
  metric_type: metricTypes.IP,
  index_file_size: 1024,
});
console.log("--- create collection ---", res);
```

Then you can list collections and 'demo_film_tutorial' will be in the result.

You can also get info of the collection.

```javascript
const collectionInfo = await milvusClient.showCollectionsInfo({
  collection_name: COLLECTION_NAME,
});
console.log("--- collection info ---", collectionInfo);
```

This tutorial is a basic intro tutorial, building index won't be covered by this tutorial.

If you want to go further into Milvus with indexes, it's recommended to check our
[Full examples](https://github.com/milvus-io/pymilvus/tree/1.0/examples/indexes)

Further more, if you want to get a thorough view of indexes, check our official website for [Vector Index](https://milvus.io/docs/index.md).

## Create Partition

If you don't create a partition, there will be a default one called "`_default`", all the entities will be inserted into the "`_default`" partition. You can check it by `list_partitions

```javascript
const partitions = await milvusClient.showPartitions({
  collection_name: COLLECTION_NAME,
});
console.log("--- partitions ---", partitions);
```

You can provide a partition tag to create a new partition.

```javascript
const res = await milvusClient.createPartition({
  collection_name: COLLECTION_NAME,
  tag: PARTITION_TAG,
});
console.log("--- create partition ---", res);
```

## Entities

An entity is a group of fields that corresponds to real world objects. In current version, Milvus only contains a vector field.

1. List 3 Entities

```javascript
const entities = new Array(3).fill(new Array(8).fill(Math.random() * 100));
```

2. Insert Entities
   If the entities inserted successfully, `ids` we provided will be returned.

```javascript
const res = await milvusClient.insert({
  collection_name: COLLECTION_NAME,
  partition_tag: PARTITION_TAG,
  records: entities.map((v, i) => ({
    value: v,
  })),
  record_type: "float",
});
```

Or you can also provide entity ids

```javascript
const res = await milvusClient.insert({
  collection_name: COLLECTION_NAME,
  partition_tag: PARTITION_TAG,
  records: entities.map((v, i) => ({
    id: i + 1,
    value: v,
  })),
  record_type: "float",
});
```

### Warning:

If the first time when `insert()` is invoked `id` is not passed into this method, each of the rest time when `insert()` is invoked `id` is not permitted to pass, otherwise server will return an error and the insertion process will fail. And vice versa.

### Note:

If `partition_tag` isn't provided, these entities will be inserted into the "`_default`" partition.
otherwise, them will be inserted into specified partition.

# Flush

After successfully inserting 3 entities into Milvus, we can `Flush` data from memory to disk so that we can retrieve them. Milvus also performs an automatic flush with a fixed interval(configurable, default 1 second),
see [Data Flushing](https://milvus.io/docs/flush_python.md)

You can flush multiple collections at one time, so be aware the parameter is a list.

```javascript
const res = await milvusClient.flush({
  collection_name_array: [COLLECTION_NAME],
});
console.log("flush", res);
```

# Count Entities

We can also count how many entities are there in the collection.

```javascript
const count = await milvusClient.countCollection({
  collection_name: COLLECTION_NAME,
});
console.log("--- count collection ---", count);
```

## Get Entities by ID

You can get entities by their ids.

```javascript
const res = await milvusClient.getVectorsByID({
  collection_name: COLLECTION_NAME,
  id_array: [1, 2],
});
console.log("--- get vectors by id ---", count);
```

If id exists, an entity will be returned. If id doesn't exist, `[]` will be return.
For the example above, the result `demo_milvus_tutorial` will only have one entity, the other is `[]`.

## Search Entities by Vector Similarity

You can get entities by vector similarity. Assuming we have a `film_A` like below, and we want to get top 2 films
that are most similar with it.

```javascript
const films_a = new Array(2).fill(new Array(8).fill(Math.random() * 100));
```

### Note

1. If the collection is index-built, user need to specify search param, and pass parameter `params` like: `milvusClient.search(..., params={...})`.
   You can refer to [Index params](https://pymilvus.readthedocs.io/en/1.0/param.html) for more details.

2. If parameter `partition_tags` is specified, milvus executes search request on these partition instead of whole collection.

3. Because vectors are randomly generated, so the retrieved vector id and distance may differ.

```javascript
const res = await milvusClient.search({
  collection_name: COLLECTION_NAME,
  topk: 2,
  extra_params: { nprobe: 16 },
  query_record_array: films_a.map((v) => ({
    float_data: v,
  })),
});
console.log("--- vector search ---", res, res.data);
```

## Deletion

Finally, let's move on to deletion in Milvus.
We can delete entities by ids, drop a whole partition, or drop the entire collection.

## Delete Entities by id

You can delete entities by their ids.

```javascript
const res = await milvusClient.deleteByIds({
  id_array: [1, 2],
  collection_name: COLLECTION_NAME,
});
```

### Note

If one entity corresponding to a specified id doesn't exist, milvus ignore it and execute next deletion.
In this case, client always return ok status except any exception occurs.

## Drop a Partition

You can also drop a partition.

### Danger

Once you drop a partition, all the data in this partition will be deleted too.

```javascript
const res = await milvusClient.dropPartition({
  collection_name: COLLECTION_NAME,
  tag: PARTITION_TAG,
});
```

## Drop a Collection

Finally, you can drop an entire collection.

### Danger

Once you drop a collection, all the data in this collection will be deleted too.

```javascript
await milvusClient.dropCollection({
  collection_name: COLLECTION_NAME,
});
```
