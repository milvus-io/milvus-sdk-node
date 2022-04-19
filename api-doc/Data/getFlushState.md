## getFlushState()
Get flush state by segment ids

### Invocation 
```javascript
new milvusClient(MILUVS_ADDRESS).dataManager.getFlushState(GetFlushStateReq);
```

### Parameter
#### GetFlushStateReq
| Parameter  | Description             | type     | required |
| ---------- | ----------------------- | -------- | -------- |
| segmentIDs | An array of segments ID | String[] | true     |

### Example
```javascript
new milvusClient(MILUVS_ADDRESS).dataManager.getFlushState({
  segmentIDs: segIds,
});
```
### Return
```javascript
// getFlushState return
```
