import { MilvusClient, InsertReq, DataType, SparseFloatVector } from '@zilliz/milvus2-sdk-node';
import { sparseVectorsData } from './Data';
const COLLECTION_NAME = 'hello_sparse';

(async () => {
  // build client
  const milvusClient = new MilvusClient({
    address: 'localhost:19530',
    username: 'username',
    password: 'Aa12345!!',
  });

  console.log('Node client is initialized.');

  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });

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
        data_type: DataType.SparseFloatVector,
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

  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: sparseVectorsData,
  };
  // insert data into collection
  await milvusClient.insert(params);
  console.log('Data is inserted.');

  // create index
  const createIndex = await milvusClient.createIndex({
    collection_name: COLLECTION_NAME,
    field_name: 'vector',
    metric_type: 'IP',
    index_type: 'SPARSE_INVERTED_INDEX',
  });

  console.log('Index is created', createIndex);

  // need load collection before search
  const load = await milvusClient.loadCollectionSync({
    collection_name: COLLECTION_NAME,
  });
  console.log('Collection is loaded.', load);

  // do the search
  for (let i = 0; i < 1; i++) {
    console.time('Search time');
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      vector: sparseVectorsData[i]['vector'],
      output_fields: ['age'],
      limit: 5,
    });
    console.timeEnd('Search time');
    console.log('Search result', search);
  }

  // drop collection
  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
})();
