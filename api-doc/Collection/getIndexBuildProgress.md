## getIndexBuildProgress()
Get index building progress.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.getIndexBuildProgress(GetIndexBuildProgressReq);
```

### Parameter
#### GetIndexBuildProgressReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.getIndexBuildProgress({
  collection_name: 'my_collection',
});
```
### Return
```javascript
// getIndexBuildProgress return
```