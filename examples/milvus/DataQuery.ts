import { MilvusClient, DataType, InsertReq } from '../../milvus';
import {
  generateInsertData,
  genCollectionParams,
  VECTOR_FIELD_NAME,
} from '../../test/tools';

const COLLECTION_NAME = 'data_query_example_collection';

(async () => {
  const milvusClient = new MilvusClient({
    address: 'localhost',
    username: 'username',
    password: 'Aa12345!!',
  });

  console.log('Node client is initialized.');

  const createParams = genCollectionParams({
    collectionName: COLLECTION_NAME,
    dim: 4,
    vectorType: DataType.FloatVector,
  });
  // // create collection
  const create = await milvusClient.createCollection(createParams);
  console.log('Create collection is finished.', create);

  // build example data
  const vectorsData = generateInsertData(createParams.fields, 10000);
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
    field_name: VECTOR_FIELD_NAME,
    metric_type: 'L2',
  });

  console.log('Index is created', createIndex);

  // need load collection before search
  const load = await milvusClient.loadCollectionSync({
    collection_name: COLLECTION_NAME,
  });
  console.log('Collection is loaded.', load);

  // do the query
  console.time('Query time');
  const query = await milvusClient.query({
    collection_name: COLLECTION_NAME,
    filter: 'age > 0',
    output_fields: ['age', 'vector'],
    limit: 100,
  });
  console.timeEnd('Query time');
  console.log('query result', query);

  // delete collection
  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
})();
