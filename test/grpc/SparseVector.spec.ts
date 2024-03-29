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
  db_name: 'sparse_object_vector_DB',
};

const p = {
  collectionName: COLLECTION_NAME,
  vectorType: [DataType.SparseFloatVector],
  dim: [24], // useless
};
const collectionParams = genCollectionParams(p);
const data = generateInsertData(collectionParams.fields, 10);

describe(`Sparse vectors type:object API testing`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create collection with sparse vectors should be successful`, async () => {
    const create = await milvusClient.createCollection(collectionParams);
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });

    const sparseFloatVectorFields = describe.schema.fields.filter(
      (field: any) => field.data_type === 'SparseFloatVector'
    );
    expect(sparseFloatVectorFields.length).toBe(1);

    // console.dir(describe.schema, { depth: null });
  });

  it(`insert sparse vector data should be successful`, async () => {
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data,
    });

    // console.log('data to insert', data);

    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(insert.succ_index.length).toEqual(data.length);
  });

  it(`create index should be successful`, async () => {
    const indexes = await milvusClient.createIndex([
      {
        collection_name: COLLECTION_NAME,
        field_name: 'vector',
        metric_type: MetricType.IP,
        index_type: IndexType.SPARSE_WAND,
        params: {
          drop_ratio_build: 0.2,
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

  it(`query sparse vector should be successful`, async () => {
    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'id > 0',
      output_fields: ['vector', 'id'],
    });

    const originKeys = Object.keys(data[0].vector);
    const originValues = Object.values(data[0].vector);

    const outputKeys: string[] = Object.keys(query.data[0].vector);
    const outputValues: number[] = Object.values(query.data[0].vector);

    expect(originKeys).toEqual(outputKeys);
    originValues.forEach((value, index) => {
      expect(value).toBeCloseTo(outputValues[index]);
    });
  });

  it(`search with sparse vector should be successful`, async () => {
    const search = await milvusClient.search({
      vector: data[0].vector,
      collection_name: COLLECTION_NAME,
      output_fields: ['id', 'vector'],
      limit: 5,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);
  });
});
