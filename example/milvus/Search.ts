import {
  MilvusClient,
  DataType,
  InsertReq,
  ConsistencyLevelEnum,
  IndexType,
} from '../../milvus';
import {
  generateInsertData,
  GENERATE_NAME,
  genCollectionParams,
  VECTOR_FIELD_NAME,
} from '../../test/tools';
const milvusClient = new MilvusClient({
  address:
    'https://in01-5b06a42cb5eb45f.aws-us-west-2.vectordb-sit.zillizcloud.com:19540',
  username: 'username',
  password: 'Aa12345!!',
});
const COLLECTION_NAME = GENERATE_NAME();

const Search = async () => {
  const createParams = genCollectionParams({
    collectionName: COLLECTION_NAME,
    dim: '4',
    vectorType: DataType.FloatVector,
  });
  // // create collection
  const create = await milvusClient.createCollection(createParams);
  console.log('create', create);

  // create index
  const createIndex = await milvusClient.createIndex({
    collection_name: COLLECTION_NAME,
    field_name: VECTOR_FIELD_NAME,
    index_type: IndexType.AUTOINDEX,
    metric_type: 'L2',
    params: {},
  });

  console.log('createIndex', createIndex);

  // need load collection before search
  const load = await milvusClient.loadCollectionSync({
    collection_name: COLLECTION_NAME,
  });
  console.log('--- load done ----', load);

  // build example data
  const vectorsData = generateInsertData(createParams.fields, 10000);
  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: vectorsData,
  };
  // insert data into collection
  await milvusClient.insert(params);

  // do the search
  for (let i = 0; i < 100; i++) {
    console.time('search total');

    await milvusClient.search({
      collection_name: COLLECTION_NAME,
      vectors: [vectorsData[i][VECTOR_FIELD_NAME]],
      output_fields: ['id', 'vector'],
      vector_type: DataType.FloatVector,
      consistency_level: ConsistencyLevelEnum.Bounded,
    });
    console.timeEnd('search total');
  }

  // delete collection
  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
};

Search();
