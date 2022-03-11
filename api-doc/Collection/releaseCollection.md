## releaseCollection()
 Releases the collection from memory.
 
### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.releaseCollection(ReleaseCollectionReq);
```

### Parameter
#### ReleaseCollectionReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.releaseCollection({
  collection_name: 'my_collection',
});
```

### Return
```javascript
// releaseCollection return
```
