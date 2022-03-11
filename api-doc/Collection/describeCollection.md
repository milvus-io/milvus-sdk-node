## describeCollection()
Show the details of a collection, e.g. name, schema.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.describeCollection(DescribeCollectionReq);
```

### Parameter
#### DescribeCollectionReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.describeCollection({
  collection_name: 'my_collection',
});
```
### Return
```javascript
// create collection return
```
