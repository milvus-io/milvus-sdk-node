import { MilvusClient, InsertReq, DataType } from '@zilliz/milvus2-sdk-node';

// milvus v2.2.9 only
const COLLECTION_NAME = 'hello_milvus';

const databaseName = 'my_db';
(async () => {
  // build client
  const milvusClient = new MilvusClient({
    address: 'localhost:19530',
    username: 'username',
    password: 'Aa12345!!',
  });

  console.log('Node client is initialized.');

  // create database
  const createDb = await milvusClient.createDatabase({ db_name: databaseName });
  console.log('Database is created', createDb);

  // use that db
  const useDb = await milvusClient.use({ db_name: 'my_db' });
  console.log('new Database is using', useDb);

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

  const collectionInfo = await milvusClient.describeCollection({
    collection_name: COLLECTION_NAME,
  });

  console.log('collection info:', collectionInfo);
})();
