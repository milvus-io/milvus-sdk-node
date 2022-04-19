## dropPartition()
To drop a partition will drop all data in this partition and the ```_default``` partition cannot be dropped.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.dropPartition(DropPartitionReq);
```

### Parameter
#### DropPartitionReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |
| partition_name  | Partition name  | String | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.dropPartition({
  collection_name: 'my_collection',
  partition_name: 'my_partition',
});
```

### Return
```javascript
// drop partition return
```