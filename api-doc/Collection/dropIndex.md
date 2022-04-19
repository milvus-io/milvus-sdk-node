## dropIndex()
List all collections or get collection loading status.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.dropIndex(DropIndexReq);
```

### Parameter
##### DropIndexReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.dropIndex({
  collection_name: 'my_collection',
});

```
### Return
```javascript
// dropIndex return
```
