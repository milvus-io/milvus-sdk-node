import http from 'http';
import { MilvusClient, InsertReq, DataType } from '@zilliz/milvus2-sdk-node';
import { vectorsData } from './Data';
const server = http.createServer();

const port = 4000;

// build client
const COLLECTION_NAME = 'hello_milvus';
const milvusClient = new MilvusClient({
  address: 'localhost:19530',
});

const prepareMilvus = async () => {
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
};

server.on('request', (req, res) => {
  milvusClient
    .search({
      collection_name: COLLECTION_NAME,
      vector: vectorsData[0]['vector'],
      output_fields: ['age'],
      limit: 1,
    })
    .then(() => {
      return res.end('ok');
    });
});

prepareMilvus().then(() => {
  // start
  server.listen(port);
  console.log(
    `⚡️[server]: Milvus app benchmark server is running at http://localhost:${port}`
  );
});
