import { MilvusClient, InsertReq, DataType } from '@zilliz/milvus2-sdk-node';

const COLLECTION_NAME = 'hello_milvus';

(async () => {
  // build client
  const milvusClient = new MilvusClient({
    address: 'localhost:19530',
    username: 'root',
    password: 'Milvus',
    logLevel: 'debug',
  });

  console.log('Node client is initialized.');
  const dim = 1024;
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
        dim: 1024,
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

  const rows = 1000;
  const batchCount = 10; // Number of times to insert

  const generateInsertData = () => {
    const data = [];
    for (let i = 0; i < rows; i++) {
      data.push({
        vector: new Array(dim).fill(0).map(() => Math.random()),
        height: 150 + i,
        name: `name_${i}`,
      });
    }
    return data;
  };

  // insert data into collection in batches
  for (let batch = 0; batch < batchCount; batch++) {
    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      fields_data: generateInsertData(),
    };
    const insert = await milvusClient.insert(params);
    console.log(`Batch ${batch + 1}: Data is inserted. ${rows} rows`, insert);
  }

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
