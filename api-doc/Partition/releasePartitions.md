## releasePartitions()
Release partitions from cache.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.releasePartitions(ReleasePartitionsReq);
```

### Parameter
#### ReleasePartitionsReq
| Parameter       | Description              | type     | required |
| --------------- | ------------------------ | -------- | -------- |
| collection_name | Collection name          | String   | true     |
| partition_names | Array of Partition names | String[] | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.releasePartitions({
  collection_name: 'my_collection',
  partition_name: ['my_partition'],
});
```

### Return
```javascript
// releasePartitions return
```