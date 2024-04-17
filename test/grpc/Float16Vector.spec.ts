import {
  MilvusClient,
  ErrorCode,
  DataType,
  IndexType,
  MetricType,
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
  db_name: 'float_vector_16',
};

const p = {
  collectionName: COLLECTION_NAME,
  vectorType: [DataType.Float16Vector],
  dim: [128],
};
const collectionParams = genCollectionParams(p);
const data = generateInsertData(collectionParams.fields, 2);

// console.log('data to insert', data);

describe(`Float16 vector API testing`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create collection with float16 vectors should be successful`, async () => {
    const create = await milvusClient.createCollection(collectionParams);
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });

    const floatVector16Fields = describe.schema.fields.filter(
      (field: any) => field.data_type === 'Float16Vector'
    );
    expect(floatVector16Fields.length).toBe(1);

    // console.dir(describe.schema, { depth: null });
  });

  it(`insert float16 vector data should be successful`, async () => {
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data,
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

  it(`query float16 vector should be successful`, async () => {
    const count = await milvusClient.count({
      collection_name: COLLECTION_NAME,
    });

    expect(count.data).toEqual(data.length);

    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'id > 0',
      output_fields: ['vector', 'id'],
    });

    // verify the query result
    data.forEach((obj, index) => {
      obj.vector.forEach((v: number, i: number) => {
        expect(v).toBeCloseTo(query.data[index].vector[i], 3);
      });
    });

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`search with float16 vector should be successful`, async () => {
    const search = await milvusClient.search({
      data: data[0].vector,
      collection_name: COLLECTION_NAME,
      output_fields: ['id', 'vector'],
      limit: 5,
    });

    // console.log('search', search);

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);
  });

  it(`search with float16 vector and nq > 0 should be successful`, async () => {
    const search = await milvusClient.search({
      data: [
        f32ArrayToF16Bytes(data[0].vector),
        f32ArrayToF16Bytes(data[1].vector),
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
