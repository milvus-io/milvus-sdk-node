## hasPartition()
Check if a partition exists in a collection.

### Invocation 

```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.hasPartition(HasPartitionReq);
```

### Parameter
#### HasPartitionReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |
| partition_name  | Partition name  | String | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.hasPartition({
  collection_name: 'my_collection',
  partition_name: 'my_partition',
});
```

### Return
```javascript
// hasPartition return
```