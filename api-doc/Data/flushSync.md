## flushSync()
It's same function as flush. But flushSync is sync function. So you can ensure it's flushed after function return the result.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.flushSync(FlushReq);
```

### Parameter
#### FlushReq
| Parameter        | Description                 | type     | required |
| ---------------- | --------------------------- | -------- | -------- |
| collection_names | An array of Collection name | String[] | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).dataManager.flushSync({
  collection_names: ['my_collection'],
});
```
### Return
```javascript
// flushSync return
```
