## showPartitions()
Show all partitions in a collection.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.showPartitions(ShowPartitionsReq);
```

### Parameter
#### ShowPartitionsReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.showPartitions({
  collection_name: 'my_collection',
});
```

### Return
```javascript
// showPartitions return
```