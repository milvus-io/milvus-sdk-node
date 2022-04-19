## flush()
Milvus temporarily buffers the newly inserted vectors in the cache. Call ```flush()``` to persist them to the object storage. It's async function, so it's will take some times to excute.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).dataManager.flush(FlushReq);
```

### Parameter
#### FlushReq
| Parameter        | Description                 | type     | required |
| ---------------- | --------------------------- | -------- | -------- |
| collection_names | An array of Collection name | String[] | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).dataManager.flush({
  collection_names: ['my_collection'],
});
```

### Return
```javascript
// flush return
```
