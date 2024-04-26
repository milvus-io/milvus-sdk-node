import {
  MilvusClient,
  ErrorCode,
  DataType,
  IndexType,
  MetricType,
  f32ArrayToBf16Bytes,
  bf16BytesToF32Array,
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
  db_name: 'Bfloat_vector_16',
};

const p = {
  collectionName: COLLECTION_NAME,
  vectorType: [DataType.BFloat16Vector],
  dim: [8],
};
const collectionParams = genCollectionParams(p);
const data = generateInsertData(collectionParams.fields, 10);

// console.log(
//   'data to insert',
//   data.map(d => d.vector)
// );

describe(`BFloat16 vector API testing`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create collection with Bfloat16 vectors should be successful`, async () => {
    const create = await milvusClient.createCollection(collectionParams);
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });

    const BfloatVector16Fields = describe.schema.fields.filter(
      (field: any) => field.data_type === 'BFloat16Vector'
    );
    expect(BfloatVector16Fields.length).toBe(1);

    // console.dir(describe.schema, { depth: null });
  });

  it(`insert Bflaot16 vector data should be successful`, async () => {
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data: data,
    });

    // console.log(' insert', insert);

    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(insert.succ_index.length).toEqual(data.length);
  });

  it(`create index should be successful`, async () => {
    const indexes = await milvusClient.createIndex([
      {
        collection_name: COLLECTION_NAME,
        field_name: 'vector',
        metric_type: MetricType.L2,
        index_type: IndexType.AUTOINDEX,
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

  it(`query Bfloat16 vector should be successful`, async () => {
    const count = await milvusClient.count({
      collection_name: COLLECTION_NAME,
    });

    expect(count.data).toEqual(data.length);

    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'id > 0',
      output_fields: ['vector', 'id'],
    });

    // console.dir(query, { depth: null });

    // verify the query result
    data.forEach((obj, index) => {
      obj.vector.forEach((v: number, i: number) => {
        expect(v).toBeCloseTo(query.data[index].vector[i], 2);
      });
    });

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`search with Bfloat16 vector should be successful`, async () => {
    const search = await milvusClient.search({
      data: f32ArrayToBf16Bytes(data[0].vector),
      collection_name: COLLECTION_NAME,
      output_fields: ['id', 'vector'],
      limit: 5,
    });

    // console.log('search', search);

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);
  });

  it(`search with Bfloat16 vector and nq > 0 should be successful`, async () => {
    const search = await milvusClient.search({
      data: [
        f32ArrayToBf16Bytes(data[0].vector),
        f32ArrayToBf16Bytes(data[1].vector),
      ],
      collection_name: COLLECTION_NAME,
      output_fields: ['id', 'vector'],
      limit: 5,
    });

    // console.log('search', search);

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);
  });
});
