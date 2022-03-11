## getIndexState()
Get index building progress.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.getIndexState(GetIndexStateReq);
```

### Parameter
#### GetIndexStateReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.getIndexState({
  collection_name: 'my_collection',
});
```

### Return
```javascript
// getIndexState return
```
