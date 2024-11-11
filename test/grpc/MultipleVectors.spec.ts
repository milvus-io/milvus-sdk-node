import {
  MilvusClient,
  ErrorCode,
  DataType,
  IndexType,
  MetricType,
  RRFRanker,
  WeightedRanker,
  f32ArrayToF16Bytes,
  f16BytesToF32Array,
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
  db_name: 'multiple_vectors',
};

const p = {
  collectionName: COLLECTION_NAME,
  vectorType: [
    DataType.FloatVector,
    DataType.FloatVector,
    DataType.Float16Vector,
    DataType.SparseFloatVector,
  ],
  dim: [8, 16, 4, 8],
};
const collectionParams = genCollectionParams(p);

describe(`Multiple vectors API testing`, () => {
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

    const floatVectorFields = describe.schema.fields.filter(
      (field: any) => field.data_type === 'FloatVector'
    );
    expect(floatVectorFields.length).toBe(2);

    // console.dir(describe.schema, { depth: null });
  });

  it(`insert multiple vector data should be successful`, async () => {
    const data = generateInsertData(collectionParams.fields, 10);
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data,
      transformers: {
        [DataType.Float16Vector]: f32ArrayToF16Bytes,
      },
    });

    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(insert.succ_index.length).toEqual(data.length);
  });

  it(`create multiple index should be successful`, async () => {
    const indexes = await milvusClient.createIndex([
      {
        collection_name: COLLECTION_NAME,
        field_name: 'vector',
        metric_type: MetricType.COSINE,
        index_type: IndexType.HNSW,
        params: {
          M: 5,
          efConstruction: 8,
        },
      },
      {
        collection_name: COLLECTION_NAME,
        field_name: 'vector1',
        metric_type: MetricType.COSINE,
        index_type: IndexType.AUTOINDEX,
      },
      {
        collection_name: COLLECTION_NAME,
        field_name: 'vector2',
        metric_type: MetricType.COSINE,
        index_type: IndexType.AUTOINDEX,
      },
      {
        collection_name: COLLECTION_NAME,
        field_name: 'vector3',
        metric_type: MetricType.IP,
        index_type: IndexType.SPARSE_WAND,
        params: {
          drop_ratio_build: 0.2,
        },
      },
    ]);

    expect(indexes.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`load multiple vector collection should be successful`, async () => {
    const load = await milvusClient.loadCollection({
      collection_name: COLLECTION_NAME,
    });

    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`query multiple vector collection should be successful`, async () => {
    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'id > 0',
      output_fields: ['vector', 'vector1', 'vector2', 'vector3'],
      transformers: {
        [DataType.Float16Vector]: f16BytesToF32Array,
      },
    });

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);

    const item = query.data[0];
    expect(item.vector.length).toEqual(p.dim[0]);
    expect(item.vector1.length).toEqual(p.dim[1]);
    expect(item.vector2.length).toEqual(p.dim[2]);
  });

  it(`search multiple vector collection with single vector search should be successful`, async () => {
    // search default first vector field
    const search0 = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: [1, 2, 3, 4, 5, 6, 7, 8],
    });
    expect(search0.status.error_code).toEqual(ErrorCode.SUCCESS);

    // search specific vector field
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: [1, 2, 3, 4, 5, 6, 7, 8],
      anns_field: 'vector',
    });
    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);

    // search second vector field
    const search2 = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
      anns_field: 'vector1',
      limit: 5,
    });

    expect(search2.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search2.results.length).toEqual(5);

    // search third vector field
    const searchF16 = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: [1, 2, 3, 4],
      anns_field: 'vector2',
    });

    expect(searchF16.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(searchF16.results.length).toEqual(search.results.length);

    // search the fourth vector field
    const searchSparse = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: { 1: 2, 3: 4 },
      anns_field: 'vector3',
      limit: 10,
    });

    expect(searchSparse.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(searchSparse.results.length).toBeGreaterThan(0);
  });

  it(`hybrid search with rrf ranker set should be successful`, async () => {
    const search = await milvusClient.hybridSearch({
      collection_name: COLLECTION_NAME,
      data: [
        {
          data: [1, 2, 3, 4, 5, 6, 7, 8],
          anns_field: 'vector',
          params: { nprobe: 2 },
        },
        {
          data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
          anns_field: 'vector1',
        },
        {
          data: f32ArrayToF16Bytes([1, 2, 3, 4]),
          anns_field: 'vector2',
        },
        {
          data: { 1: 2, 3: 4 },
          anns_field: 'vector3',
        },
      ],
      rerank: RRFRanker(),
      limit: 5,
      output_fields: ['id', 'vector2', 'vector3'],
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toEqual(5);
    expect(Object.keys(search.results[0]).length).toEqual(4);
  });

  it(`hybrid search with weighted ranker set should be successful`, async () => {
    const search = await milvusClient.hybridSearch({
      collection_name: COLLECTION_NAME,
      data: [
        {
          data: [1, 2, 3, 4, 5, 6, 7, 8],
          anns_field: 'vector',
          params: { nprobe: 2 },
        },
        {
          data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
          anns_field: 'vector1',
        },
      ],
      rerank: WeightedRanker([0.9, 0.1]),
      limit: 5,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toEqual(5);
  });

  it(`hybrid search without ranker set should be successful`, async () => {
    const search = await milvusClient.hybridSearch({
      collection_name: COLLECTION_NAME,
      data: [
        {
          data: [1, 2, 3, 4, 5, 6, 7, 8],
          anns_field: 'vector',
          params: { nprobe: 2 },
        },
        {
          data: f32ArrayToF16Bytes([1, 2, 3, 4]),
          anns_field: 'vector2',
        },
      ],
      limit: 5,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toEqual(5);
  });

  it(`hybrid search with nq > 1 should be successful`, async () => {
    const search = await milvusClient.hybridSearch({
      collection_name: COLLECTION_NAME,
      data: [
        {
          data: [
            [1, 2, 3, 4, 5, 6, 7, 8],
            [1, 2, 3, 4, 5, 6, 7, 8],
          ],
          anns_field: 'vector',
          params: { nprobe: 2 },
        },
        {
          data: [
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
          ],
          anns_field: 'vector1',
        },
      ],
      limit: 2,
      output_fields: ['vector', 'vector1'],
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toEqual(2);
    expect(search.results[0].length).toEqual(2);
    expect(search.results[1].length).toEqual(2);
  });

  it(`hybrid search with one vector should be successful`, async () => {
    const search = await milvusClient.hybridSearch({
      collection_name: COLLECTION_NAME,
      data: [
        {
          data: [1, 2, 3, 4, 5, 6, 7, 8],
          anns_field: 'vector',
          params: { nprobe: 2 },
        },
      ],
      limit: 5,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toEqual(5);
  });

  it(`user can use search api for hybrid search`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: [
        {
          data: [1, 2, 3, 4, 5, 6, 7, 8],
          anns_field: 'vector',
          params: { nprobe: 2 },
        },
        {
          data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
          anns_field: 'vector1',
        },
      ],
      limit: 5,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toEqual(5);
  });

  it(`hybrid search result should be equal to the original search result`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: [
        {
          data: [1, 2, 3, 4, 5, 6, 7, 8],
          anns_field: 'vector',
          params: { nprobe: 2 },
        },
      ],
      limit: 5,
    });

    const originSearch = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: [1, 2, 3, 4, 5, 6, 7, 8],
      limit: 5,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(originSearch.status.error_code).toEqual(search.status.error_code);
    expect(originSearch.results.length).toEqual(search.results.length);

    expect(search.results.map(r => r.id)).toEqual(
      originSearch.results.map(r => r.id)
    );
  });
});
