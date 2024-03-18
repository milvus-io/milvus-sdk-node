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

const milvusClient = new MilvusClient({ address: IP });
const COLLECTION_NAME = GENERATE_NAME();

const dbParam = {
  db_name: 'sparse_vector',
};

const p = {
  collectionName: COLLECTION_NAME,
  vectorType: [DataType.SparseFloatVector],
  dim: [8],
};
const collectionParams = genCollectionParams(p);

describe(`Sparse vectors API testing`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create collection with multiple vectors should be successful`, async () => {
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

  it(`insert multiple vector data should be successful`, async () => {
    const data = generateInsertData(collectionParams.fields, 10);
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data,
    });

    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(insert.succ_index.length).toEqual(data.length);
  });

  it(`create multiple index should be successful`, async () => {
    const indexes = await milvusClient.createIndex([
      {
        collection_name: COLLECTION_NAME,
        field_name: 'vector',
        metric_type: MetricType.IP,
        index_type: IndexType.HNSW,
        params: {
          drop_ratio_build: 0.2,
        },
      },
    ]);

    expect(indexes.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
