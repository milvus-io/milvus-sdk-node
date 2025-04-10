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
  db_name: 'sparse_dict_vector_DB',
};

const p = {
  collectionName: COLLECTION_NAME,
  vectorType: [DataType.SparseFloatVector],
  dim: [24], // useless
  fields: [
    {
      data_type: DataType.Int16,
      name: 'int',
    },
  ],
};
const collectionParams = genCollectionParams(p);
const data = generateInsertData(collectionParams.fields, 10);

describe(`Sparse vectors type:dict API testing`, () => {
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
  });

  it(`insert sparse vector data should be successful`, async () => {
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data,
    });

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
          inverted_index_algo: 'DAAT_MAXSCORE',
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
      data: data[0].vector,
      collection_name: COLLECTION_NAME,
      output_fields: ['id', 'vector'],
      limit: 5,
      params: {
        drop_ratio_search: 0.2,
        dim_max_score_ratio: 0.9,
      },
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);
  });

  it(`search with sparse vector with nq > 1 should be successful`, async () => {
    const search = await milvusClient.search({
      data: [
        data[0].vector,
        data[1].vector,
        data[2].vector,
        data[3].vector,
        data[4].vector,
        data[5].vector,
      ],
      collection_name: COLLECTION_NAME,
      output_fields: ['id', 'vector', 'int'],
      limit: 5,
      filter: 'int < 128',
      params: {
        radius: 0.1,
        range_filter: 1,
        drop_ratio_search: 0.2,
        dim_max_score_ratio: 0.9,
      },
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toEqual(6);
  });
});
