## loadCollectionSync()
Loads the collection to memory (for search or query). It's sync function. Help to ensure this collection is loaded.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.loadCollectionSync(LoadCollectionReq);
```

### Parameter
#### LoadCollectionReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.loadCollectionSync({
  collection_name: 'my_collection',
});
```

### Return
```javascript
// loadCollectionSync return
```
