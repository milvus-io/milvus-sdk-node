import { MilvusClient, InsertReq, DataType } from '@zilliz/milvus2-sdk-node';

const COLLECTION_NAME = 'hello_milvus';

(async () => {
  // build client
  const milvusClient = new MilvusClient({
    address: 'localhost:19530',
    username: 'root',
    password: 'Milvus',
  });

  console.log('Node client is initialized.');
  // create collection
  const create = await milvusClient.createCollection({
    collection_name: COLLECTION_NAME,
    fields: [
      {
        name: 'age',
        description: 'ID field',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
      {
        name: 'vector',
        description: 'Vector field',
        data_type: DataType.FloatVector,
        dim: 8,
      },
      { name: 'height', description: 'int64 field', data_type: DataType.Int64 },
      {
        name: 'name',
        description: 'VarChar field',
        data_type: DataType.VarChar,
        max_length: 128,
      },
    ],
  });
  console.log('Create collection is finished.', create);

  const rows = 50000;

  const generateInsertData = () => {
    const data = [];
    for (let i = 0; i < rows; i++) {
      data.push({
        vector: new Array(8).fill(0).map(() => Math.random()),
        height: 150 + i,
        name: `name_${i}`,
      });
    }
    return data;
  };

  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: generateInsertData(),
  };
  // insert data into collection
  await milvusClient.insert(params);
  console.log(`Data is inserted. ${rows} rows`);

  // create index
  const createIndex = await milvusClient.createIndex({
    collection_name: COLLECTION_NAME,
    field_name: 'vector',
    metric_type: 'L2',
  });

  console.log('Index is created', createIndex);

  // need load collection before search
  const load = await milvusClient.loadCollectionSync({
    collection_name: COLLECTION_NAME,
  });
  console.log('Collection is loaded.', load);

  // use queryiterator to get data
  const query = await milvusClient.queryIterator({
    collection_name: COLLECTION_NAME,
    output_fields: ['age', 'vector', 'height', 'name'],
    batchSize: 1000,
    limit: 10000,
  });

  console.time('Query time');
  const time = new Date().getTime();
  for await (const data of query) {
    // calculate the time
    const now = new Date().getTime();

    console.log('time cost', now - time);
  }
  console.timeEnd('Query time');

  // drop collection
  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log('Collection is dropped.');
})();
