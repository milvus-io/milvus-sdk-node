## loadBalance()
Do load balancing operation from source query node to destination query node. Only work in milvus cluster.

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).dataManager.loadBalance(LoadBalanceReq);
```

### Parameter
#### LoadBalanceReq
| Parameter         | Description                                          | type     | required |
| ----------------- | ---------------------------------------------------- | -------- | -------- |
| src_nodeID        | The source query node id to balance.                 | Number   | true     |
| dst_nodeIDs       | The destination query node ids to balance.(optional) | Number[] | false    |
| sealed_segmentIDs | Sealed segment ids to balance.(optional)             | Number[] | false    |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).dataManager.loadBalance({
  src_nodeID: 31,
});
```
### Return
```javascript
// getQuerySegmentInfo return
```
