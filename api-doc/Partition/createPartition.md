## createPartition()
Create a partition in a collection.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.createPartition(CreatePartitionReq);
```

### Parameter
#### CreatePartitionReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |
| partition_name  | Partition name  | String | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.createPartition({
  collection_name: 'my_collection',
  partition_name: 'my_partition',
});
```

### Return
```javascript
// create partition return
```