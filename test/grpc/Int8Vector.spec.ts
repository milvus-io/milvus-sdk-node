import {
  MilvusClient,
  ErrorCode,
  DataType,
  IndexType,
  MetricType,
} from '../../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
const COLLECTION_NAME = GENERATE_NAME();

const dbParam = {
  db_name: 'int8_vector_DB',
};

const p = {
  collectionName: COLLECTION_NAME,
  vectorType: [DataType.Int8Vector],
  dim: [8],
  int8Type: 'array',
};

const typedP = {
  collectionName: COLLECTION_NAME,
  vectorType: [DataType.Int8Vector],
  dim: [8],
  int8Type: 'typed_array',
};

const collectionParamsWithArr = genCollectionParams(p);
const collectionParamsWithTypedArr = genCollectionParams(typedP);

const data = generateInsertData(collectionParamsWithArr.fields, 4);
const typedData = generateInsertData(collectionParamsWithTypedArr.fields, 4);

// console.dir(data, { depth: null });
describe(`Int8 vectors API testing`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create collection with int8 vectors should be successful`, async () => {
    const create = await milvusClient.createCollection(collectionParamsWithArr);
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });

    const int8VField = describe.schema.fields.filter(
      (field: any) => field.data_type === 'Int8Vector'
    );
    expect(int8VField.length).toBe(1);
  });

  it(`insert int8 vector data should be successful`, async () => {
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data,
    });

    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(insert.succ_index.length).toEqual(data.length);

    const insertTyped = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data: typedData,
    });

    expect(insertTyped.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`create index should be successful`, async () => {
    const indexes = await milvusClient.createIndex([
      {
        collection_name: COLLECTION_NAME,
        field_name: 'vector',
        metric_type: MetricType.L2,
        index_type: IndexType.HNSW,
        params: {
          M: 16,
          efConstruction: 200,
        },
      },
    ]);

    expect(indexes.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`load collection should be successful`, async () => {
    const load = await milvusClient.loadCollection({
      collection_name: COLLECTION_NAME,
    });

    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`query int8 vector should be successful`, async () => {
    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'id > 0',
      output_fields: ['vector', 'id'],
    });

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(query.data.length).toEqual(data.length + typedData.length);

    // console.dir(query, { depth: null });
  });

  it(`search with int8 vector should be successful`, async () => {
    const search = await milvusClient.search({
      data: data[0].vector,
      collection_name: COLLECTION_NAME,
      output_fields: ['id', 'vector'],
      limit: 5,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);

    const searchTyped = await milvusClient.search({
      data: typedData[0].vector,
      collection_name: COLLECTION_NAME,
      output_fields: ['id', 'vector'],
      limit: 5,
    });

    expect(searchTyped.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(searchTyped.results.length).toBeGreaterThan(0);
  });

  it(`search with int8 vector with nq > 1 should be successful`, async () => {
    const search = await milvusClient.search({
      data: [data[0].vector, data[1].vector],
      collection_name: COLLECTION_NAME,
      output_fields: ['id', 'vector'],
      limit: 5,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toEqual(2);
  });
});
