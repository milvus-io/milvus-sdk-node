## showCollections()
List all collections or get collection loading status.

### Invocation
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.showCollections(ShowCollectionsReq);
```

### Parameter
#### ShowCollectionsReq
| Parameter       | Description         | type                | required |
| --------------- | ------------------- | ------------------- | -------- |
| collection_name | Collection name     | String              | true     |
| type            | ShowCollectionsType | ShowCollectionsType | false    |

#### ShowCollectionsType
| value | Description | type   | required |
| ----- | ----------- | ------ | -------- |
| 0     | All         | number | false    |
| 1     | Loaded      | number | false    |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).collectionManager.showCollections();
```

### Return
```javascript
// showCollections return
```
