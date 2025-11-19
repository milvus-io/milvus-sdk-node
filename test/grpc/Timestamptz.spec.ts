import { MilvusClient, ErrorCode, IndexType, MetricType } from '../../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
  DEFAULT_TIMESTAMPTZ_VALUE,
  MAX_CAPACITY,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
const COLLECTION_NAME = GENERATE_NAME();

const dbParam = {
  db_name: 'timestamptz',
};

const p = {
  collectionName: COLLECTION_NAME,
  dim: [4],
};
const collectionParams = genCollectionParams(p);
const data = generateInsertData(collectionParams.fields, 10);

describe(`Timestamptz API testing`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create collection with timestamptz vectors should be successful`, async () => {
    const create = await milvusClient.createCollection(collectionParams);
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });

    const timestamptzFields = describe.schema.fields.filter(
      (field: any) => field.data_type === 'Timestamptz'
    );
    expect(timestamptzFields.length).toBe(1);

    // const timestamptzArrayFields = describe.schema.fields.filter(
    //   (field: any) =>
    //     field.data_type === 'Array' && field.element_type === 'Timestamptz'
    // );
    // expect(timestamptzArrayFields.length).toBe(1);

    // expect(timestamptzArrayFields[0].max_capacity).toEqual(MAX_CAPACITY);

    // check default value
    expect(new Date(timestamptzFields[0].default_value as any)).toEqual(
      new Date(DEFAULT_TIMESTAMPTZ_VALUE)
    );

    // console.dir(describe.schema, { depth: null });
  });

  it(`insert timestamptz data should be successful`, async () => {
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

  it(`query timestamptz should be successful`, async () => {
    const count = await milvusClient.count({
      collection_name: COLLECTION_NAME,
    });

    expect(count.data).toEqual(data.length);

    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'id > 0',
      output_fields: ['vector', 'id', 'timestamptz'],
      limit: 2,
    });

    // verify the query result
    expect(new Date(query.data[0].timestamptz)).toEqual(
      new Date(data[0].timestamptz || DEFAULT_TIMESTAMPTZ_VALUE)
    );
    expect(new Date(query.data[1].timestamptz)).toEqual(
      new Date(data[1].timestamptz || DEFAULT_TIMESTAMPTZ_VALUE)
    );

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`search output fields with timestamptz should be successful`, async () => {
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

  it(`search with timestamptz vector and nq > 0 should be successful`, async () => {
    const search = await milvusClient.search({
      data: [data[0].vector, data[1].vector],
      collection_name: COLLECTION_NAME,
      output_fields: ['id', 'vector'],
      limit: 5,
    });

    // console.log('search', search);
    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);
  });
});
