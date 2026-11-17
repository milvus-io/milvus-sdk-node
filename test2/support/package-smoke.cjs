const { MilvusClient, DataType, IndexType, MetricType, ErrorCode } = require(
  process.argv[2]
);
const { randomBytes } = require('crypto');
const client = new MilvusClient({
  address: process.env.MILVUS_PACKAGE_ADDRESS,
});
const collection_name = `package_${randomBytes(8).toString('hex')}`;
const success = result => {
  const status = result.status || result;
  if (status.error_code !== ErrorCode.SUCCESS)
    throw new Error(JSON.stringify(status));
};
(async () => {
  let created = false;
  try {
    success(
      await client.createCollection({
        collection_name,
        consistency_level: 'Strong',
        fields: [
          {
            name: 'id',
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: false,
          },
          { name: 'vector', data_type: DataType.FloatVector, dim: 4 },
        ],
      })
    );
    created = true;
    success(
      await client.insert({
        collection_name,
        data: [{ id: 1, vector: [1, 0, 0, 0] }],
      })
    );
    success(
      await client.createIndex({
        collection_name,
        field_name: 'vector',
        index_type: IndexType.FLAT,
        metric_type: MetricType.L2,
      })
    );
    success(await client.loadCollectionSync({ collection_name }));
    const search = await client.search({
      collection_name,
      data: [1, 0, 0, 0],
      output_fields: ['id'],
      limit: 1,
    });
    success(search);
    if (String(search.results[0]?.id) !== '1')
      throw new Error(`Unexpected search result: ${JSON.stringify(search)}`);
    success(await client.delete({ collection_name, filter: 'id == 1' }));
    const query = await client.query({ collection_name, filter: 'id > 0' });
    success(query);
    if (query.data.length) throw new Error('Deleted row remains visible');
  } finally {
    try {
      if (created) success(await client.dropCollection({ collection_name }));
    } finally {
      await client.closeConnection();
    }
  }
})().catch(error => {
  console.error('[published package lifecycle]', error);
  process.exitCode = 1;
});
