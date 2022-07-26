# showPartitions()
Show all partitions in a collection.

## Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.showPartitions(ShowPartitionsReq);
```

## Parameter
### ShowPartitionsReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |

## Example
```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.showPartitions({
  collection_name: 'my_collection',
});
```

## Return
```javascript
{
  status: { error_code: 'Success', reason: '' },
  partition_names: [ '_default', 'my_partition' ],
  partitionIDs: [ '434827144696954882', '434827353243779073' ],
  created_timestamps: [ '434827144696954883', '434827353243779075' ],
  created_utc_timestamps: [ '1658733919895', '1658734715438' ],
  inMemory_percentages: []
}
```