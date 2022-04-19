## insert()
Insert data into collection.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).dataManager.insert(InsertReq);
```

### Parameter
#### getQuerySegmentInfoReq
| Parameter                | Description                               | type                   | required |
| ------------------------ | ----------------------------------------- | ---------------------- | -------- |
| collection_name          | Collection name                           | String                 | true     |
| partition_name(optional) | partition name                            | String                 | false    |
| fields_data              | vector data                               | { [x: string]: any }[] | false    |
| hash_keys(optional)      | The hash value depends on the primary key | Number[]               | false    |

#### note 
If the field type is binary, the vector data length needs to be dimension / 8

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).dataManager.insert({
  collection_name: COLLECTION_NAME,
  fields_data: [{
    vector_field: [1,2,2,4],
    scalar_field: 1
  }]
});
```
### Return
```javascript
// getQuerySegmentInfo return
```
