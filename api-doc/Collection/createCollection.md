## createCollection()
Creates a collection with the specified schema.

### Invocation
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.createCollection(CreateCollectionReq);
```

### Parameter
#### CreateCollectionReq(object)
| Parameter       | Description      | type   | required |
| --------------- | ---------------- | ------ | -------- |
| collection_name | Collection name  | String | true     |
| fields          | schema to create | Fields | true     |

#### Fields(object)
| Parameter      | Description          | type     | required |
| -------------- | -------------------- | -------- | -------- |
| name           | Field name           | String   | true     |
| description    | Field description    | String   | true     |
| data_type      | Field type           | DataType | true     |
| type_params    | Vector Field param   | Object   | false    |
| autoID         | Is auto generated ID | Bool     | false    |
| is_primary_key | Is primary key       | Bool     | false    |

#### DataType
| Value | Description  |
| ----- | ------------ |
| 0     | none         |
| 1     | Bool         |
| 2     | Int8         |
| 3     | Int16        |
| 4     | Int32        |
| 5     | Int64        |
| 10    | Float        |
| 11    | Double       |
| 20    | String       |
| 100   | BinaryVector |
| 101   | FloatVector  |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.createCollection({
  collection_name: 'my_collection',
  fields: [
    {
      name: "vector_01",
      description: "vector field",
      data_type: DataType.FloatVect,
      type_params: {
        dim: "8"
      }
    },
    {
      name: "age",
      data_type: DataType.Int64,
      autoID: true,
      is_primary_key: true,
      description: "",
    },
  ],
});
```

### Return
```javascript
// create collection return
```
