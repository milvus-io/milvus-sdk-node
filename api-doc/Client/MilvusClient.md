## MilvusClient()
A class to initialize a milvus client instance, once connected, you can perform operations from this client.

### Invocation
```javascript
const milvusClient = new MilvusClient(MILUVS_ADDRESS);
```

### Parameter
| Parameter      | Description       | type   | example           |
| -------------- | ----------------- | ------ | ----------------- |
| MILUVS_ADDRESS | milvus ip address | String | 'localhost:19530' |

### Example
```javascript
const milvusAddress = `192.168.0.1`;
const milvusClient = new MilvusClien(MILUVS_ADDRESS);
```
