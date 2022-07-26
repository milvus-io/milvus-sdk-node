# getPartitionStatistics()
Show the statistics information of a partition.

## Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.getPartitionStatistics(GetPartitionStatisticsReq);
```

## Parameter
### GetPartitionStatisticsReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |
| partition_name  | Partition name  | String | true     |

## Example
```javascript
new milvusClient(MILUVS_ADDRESS).partitionManager.getPartitionStatistics({
  collection_name: 'my_collection',
  partition_name: 'my_partition',
});
```

## Return
```javascript
{
  status: { error_code: 'Success', reason: '' },
  data: { row_count: '0' },
  stats: [ { key: 'row_count', value: '0' } ]
}
```