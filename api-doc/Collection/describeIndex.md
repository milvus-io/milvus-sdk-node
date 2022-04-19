## describeIndex()
List all collections or get collection loading status.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.describeIndex(DescribeIndexReq);
```

### Parameter
#### DescribeIndexReq
| Parameter       | Description     | type   | required |
| --------------- | --------------- | ------ | -------- |
| collection_name | Collection name | String | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.describeIndex({
  collection_name: 'my_collection',
});
```

### Return
```javascript
// describeIndex return
```
