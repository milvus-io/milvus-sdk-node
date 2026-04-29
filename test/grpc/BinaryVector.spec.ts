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
  db_name: 'binary_vector_test',
};

const p = {
  collectionName: COLLECTION_NAME,
  vectorType: [DataType.BinaryVector, DataType.BinaryVector],
  dim: [16, 16],
};
const collectionParams = genCollectionParams(p);
const data = generateInsertData(collectionParams.fields, 10);

const deterministicBinaryRows = [
  { ...data[0], int64: 1000, vector: [0x00, 0xff], vector1: [0x0f, 0xf0] },
  { ...data[1], int64: 1001, vector: [0xaa, 0x55], vector1: [0x33, 0xcc] },
  { ...data[2], int64: 1002, vector: [0x12, 0x34], vector1: [0x56, 0x78] },
];

const expectBinaryVector = (actual: number[], expected: number[]) => {
  expect(actual).toEqual(expected);
};

describe(`Binary vectors API testing`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create collection with binary vectors should be successful`, async () => {
    const create = await milvusClient.createCollection(collectionParams);
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });

    const binaryVectorFields = describe.schema.fields.filter(
      (field: any) => field.data_type === 'BinaryVector'
    );
    expect(binaryVectorFields.length).toBe(2);

    // console.dir(describe.schema, { depth: null });
  });

  it(`insert binary vector data should be successful`, async () => {
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data: [...data, ...deterministicBinaryRows],
    });

    // console.log('data to insert', data);

    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(insert.succ_index.length).toEqual(
      data.length + deterministicBinaryRows.length
    );
  });

  it(`create index should be successful`, async () => {
    const indexes = await milvusClient.createIndex([
      {
        collection_name: COLLECTION_NAME,
        field_name: 'vector',
        metric_type: MetricType.HAMMING,
        index_type: IndexType.BIN_IVF_FLAT,
        params: {
          nlist: 10,
        },
      },
      {
        collection_name: COLLECTION_NAME,
        field_name: 'vector1',
        metric_type: MetricType.HAMMING,
        index_type: IndexType.BIN_IVF_FLAT,
        params: {
          nlist: 10,
        },
      },
      // {
      //   collection_name: COLLECTION_NAME,
      //   field_name: 'vector1',
      //   metric_type: MetricType.MHJACCARD,
      //   index_type: IndexType.MINHASH_LSH,
      //   params: {
      //     mh_lsh_band: 60,
      //     mh_element_bit_width: 100,
      //   },
      // },
    ]);

    expect(indexes.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`load collection should be successful`, async () => {
    const load = await milvusClient.loadCollection({
      collection_name: COLLECTION_NAME,
    });

    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`query binary vector should be successful`, async () => {
    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'id > 0',
      output_fields: ['vector', 'id'],
    });

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`query binary vector bytes should match inserted data`, async () => {
    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'int64 >= 1000 and int64 <= 1002',
      output_fields: ['int64', 'vector', 'vector1'],
    });

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(query.data.length).toEqual(deterministicBinaryRows.length);

    const sortedRows = [...query.data].sort(
      (a, b) => Number(a.int64) - Number(b.int64)
    );
    deterministicBinaryRows.forEach((expected, index) => {
      expect(Number(sortedRows[index].int64)).toEqual(expected.int64);
      expectBinaryVector(sortedRows[index].vector, expected.vector);
      expectBinaryVector(sortedRows[index].vector1, expected.vector1);
    });
  });

  it(`search with binary vector should be successful`, async () => {
    const search = await milvusClient.search({
      data: data[0].vector,
      collection_name: COLLECTION_NAME,
      output_fields: ['id', 'vector'],
      limit: 5,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);
  });

  it(`search binary vector bytes should match inserted data`, async () => {
    const search = await milvusClient.search({
      data: deterministicBinaryRows[0].vector,
      collection_name: COLLECTION_NAME,
      filter: 'int64 >= 1000 and int64 <= 1002',
      output_fields: ['int64', 'vector', 'vector1'],
      limit: 3,
      params: { nprobe: 10 },
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);

    const exactHit = (search.results as any[]).find(
      result => Number(result.int64) === deterministicBinaryRows[0].int64
    );
    expect(exactHit).toBeDefined();
    expect(exactHit.score).toEqual(0);
    expectBinaryVector(exactHit.vector, deterministicBinaryRows[0].vector);
    expectBinaryVector(exactHit.vector1, deterministicBinaryRows[0].vector1);
  });
});
