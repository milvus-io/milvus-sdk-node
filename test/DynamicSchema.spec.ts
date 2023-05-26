import { MilvusClient, DataType, ErrorCode } from '../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
} from './tools';

const milvusClient = new MilvusClient({ address: IP, debug: false });
const COLLECTION = GENERATE_NAME();
const numPartitions = 3;

const dynamicFields = [
  {
    name: 'dynamic_int64',
    description: 'dynamic int64 field',
    data_type: 'Int64', // test string type
  },
  {
    name: 'dynamic_varChar',
    description: 'VarChar field',
    data_type: DataType.VarChar,
    max_length: 128,
  },
  {
    name: 'dynamic_JSON',
    description: 'JSON field',
    data_type: DataType.JSON,
  },
];

// create
const createCollectionParams = genCollectionParams({
  collectionName: COLLECTION,
  dim: 4,
  vectorType: DataType.FloatVector,
  autoID: false,
  partitionKeyEnabled: true,
  numPartitions,
  enableDynamic: true,
});

describe(`Dynamic schema API`, () => {
  // beforeAll(async () => {
  //   const cols = await milvusClient.showCollections();
  //   cols.data.forEach(async col => {
  //     await milvusClient.dropCollection({ collection_name: col.name });
  //   });
  // });
  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION,
    });
  });

  it(`Create dynamic schema collection should success`, async () => {
    const create = await milvusClient.createCollection(createCollectionParams);

    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    // describe
    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION,
    });

    // console.log('describe', describe);
  });

  it(`Insert data with dynamic field should success`, async () => {
    const data = generateInsertData(
      [...createCollectionParams.fields, ...dynamicFields],
      20
    );

    // console.log(data);
    const insert = await milvusClient.insert({
      collection_name: COLLECTION,
      fields_data: data,
    });

    // console.log('insert', insert);
    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create index and load with dynamic field should success`, async () => {
    // create index
    const createIndex = await milvusClient.createIndex({
      collection_name: COLLECTION,
      index_name: 't',
      field_name: 'vector',
      index_type: 'IVF_FLAT',
      metric_type: 'L2',
      params: { nlist: 1024 },
    });

    // console.log('createIndex', createIndex);
    expect(createIndex.error_code).toEqual(ErrorCode.SUCCESS);

    // load
    const load = await milvusClient.loadCollectionSync({
      collection_name: COLLECTION,
    });

    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`query with dynamic field should success`, async () => {
    // query
    const query = await milvusClient.query({
      collection_name: COLLECTION,
      limit: 10,
      expr: 'age > 0',
      output_fields: [
        'meta',
        'vector',
        'age',
        'dynamic_int64',
        'dynamic_varChar',
      ],
    });

    // console.log('query', query.data);

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(query.data.length).toEqual(10);
  });

  it(`search with dynamic field should success`, async () => {
    // query
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 10,
      vectors: [
        [1, 2, 3, 4],
        [1, 2, 3, 4],
      ],
      expr: 'age > 0',
      output_fields: ['*'],
    });

    // console.log('search', search);
    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toEqual(2);
    expect(search.results[0].length).toEqual(10);

    // query
    const search2 = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 10,
      vector: [1, 2, 3, 4],
      expr: 'age > 0',
      output_fields: ['meta', 'age', 'dynamic_int64', 'dynamic_varChar'],
    });
    expect(search2.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search2.results.length).toEqual(10);
  });
});
