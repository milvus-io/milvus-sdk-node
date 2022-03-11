## deleteEntities()
Delete entities in a collection

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).dataManager.deleteEntities(DeleteEntitiesReq);
```

### Parameter
#### DeleteEntitiesReq
| Parameter                | Description                                  | type   | required |
| ------------------------ | -------------------------------------------- | ------ | -------- |
| collection_name          | Collection name                              | String | true     |
| partition_name(optional) | partition name                               | String | false    |
| expr                     | Boolean expression used to filter attribute. | String | false    |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).dataManager.deleteEntities({
   collection_name: COLLECTION_NAME,
   expr: 'id in [1,2,3,4]'
 });
 ```
 
### Return
```javascript
// DeleteEntitiesReq return
```
