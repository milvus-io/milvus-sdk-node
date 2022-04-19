## query()
Conducts a vector query.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).dataManager.query(QueryReq);
```

### Parameter
#### QueryReq
| Parameter                  | Description                           | type     | required |
| -------------------------- | ------------------------------------- | -------- | -------- |
| collection_name            | Collection name                       | String   | true     |
| output_fields              | Vector or scalar field to be returned | String[] | true     |
| expr(optional)             | Scalar field filter expression        | String   | false    |
| partitions_names(optional) | Array of partition names              | string[] | false    |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).dataManager.query({
  collection_name: 'my_collection',
  expr: "age in [1,2,3,4,5,6,7,8]",
  output_fields: ["age"],
});
```
### Return
```javascript
// query return
```
