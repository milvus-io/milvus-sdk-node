## loadCollection()
Loads the collection to memory (for search or query).

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.loadCollection(LoadCollectionReq);
```

### Parameter
#### LoadCollectionReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.loadCollection({
  collection_name: 'my_collection',
});
```

### Return
```javascript
// loadCollection return
```
