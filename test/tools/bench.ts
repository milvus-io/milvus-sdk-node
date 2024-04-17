import { MilvusClient, InsertReq, DataType } from '../../milvus';
import { generateInsertData } from '.';

const COLLECTION_NAME = 'bench_milvus';
(async () => {
  // build client
  const milvusClient = new MilvusClient({
    address: 'localhost:19530',
    username: 'username',
    password: 'Aa12345!!',
  });

  console.log('Node client is initialized.');
  const fields = [
    {
      name: 'id',
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
    { name: 'int64', description: 'int64 field', data_type: DataType.Int64 },
    {
      name: 'varChar',
      description: 'VarChar field',
      data_type: DataType.VarChar,
      max_length: 128,
    },
  ];
  // create collection
  const create = await milvusClient.createCollection({
    collection_name: COLLECTION_NAME,
    fields,
  });
  console.log('Create collection is finished.', create);

  // build example data
  const vectorsData = generateInsertData(fields, 10000);
  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: vectorsData,
  };
  // insert data into collection
  await milvusClient.insert(params);
  console.log('Data is inserted.');

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

  // do the search
  for (let i = 0; i < 50; i++) {
    console.time('Search time');
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: vectorsData[i]['vector'],
      output_fields: ['id', 'int64', 'varChar'],
      limit: 5,
    });
    console.timeEnd('Search time');
  }

  // drop collection
  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
})();
