## loadPartitions()
Load some partitions into cache.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.loadPartitions(LoadPartitionsReq);
```

### Parameter
#### LoadPartitionsReq
| Parameter       | Description              | type     | required |
| --------------- | ------------------------ | -------- | -------- |
| collection_name | Collection name          | String   | true     |
| partition_names | Array of Partition names | String[] | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.loadPartitions({
  collection_name: 'my_collection',
  partition_name: ['my_partition'],
});
```

### Return
```javascript
// loadPartitions return
```