## getCollectionStatistics()
Drop a collection. It will delete all data in the collection.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.getCollectionStatistics(GetCollectionStatisticsReq);
```

### Parameter
#### GetCollectionStatisticsReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |


### Example
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.getCollectionStatistics({
  collection_name: 'my_collection',
});
```
### Return
```javascript
// getCollectionStatistics return
```
