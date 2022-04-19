## hasCollection()
Check if the collection exists.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.hasCollection(HasCollectionReq);
```

### Parameter
#### HasCollectionReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.hasCollection({
  collection_name: 'my_collection',
});
```

### Return
```javascript
// hasCollection return
```
