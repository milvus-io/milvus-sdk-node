import { createClient } from '../support/client';
import { expectSuccess } from '../support/assertions';
import { MilvusClient, DataType } from '../../milvus';
import { IP, GENERATE_NAME, generateInsertData } from '../fixtures';

const milvusClient = createClient({ address: IP, logLevel: 'info' });
const COLLECTION_NAME = GENERATE_NAME();
const schema = [
  {
    name: 'vector',
    description: 'Vector field',
    data_type: DataType.FloatVector,
    dim: Number(4),
  },
  {
    name: 'id',
    description: 'ID field',
    data_type: DataType.Int64,
    is_primary_key: true,
    autoID: true,
  },
  {
    name: 'varChar',
    description: 'VarChar field',
    data_type: DataType.VarChar,
    max_length: 128,
    is_partition_key: false,
  },
  {
    name: 'array',
    description: 'array field',
    data_type: DataType.Array,
    element_type: DataType.VarChar,
    max_capacity: 128,
    max_length: 128,
    is_partition_key: false,
  },
];

describe(`Partial load API `, () => {
  it(`Create collection should be successful`, async () => {
    const res = await milvusClient.createCollection({
      collection_name: COLLECTION_NAME,
      fields: schema,
    });
    expectSuccess(res);
  });

  it(`Describe collection should be successful`, async () => {
    const desc = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(desc.schema.fields.length).toEqual(schema.length);
  });

  it(`Create index should be successful`, async () => {
    const index = await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'vector',
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    expectSuccess(index);
  });

  it(`load collection should be successful`, async () => {
    const load = await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
      load_fields: ['vector', 'id', 'varChar'],
    });
    expectSuccess(load);
  });

  it(`insert data should be successful`, async () => {
    const data = generateInsertData(schema);
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data,
    });
    expectSuccess(insert.status);
  });

  it(`query should be successful`, async () => {
    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: `id > 0`,
      output_fields: ['*'],
    });
    // console.dir(query, { depth: null });
    expectSuccess(query.status);
    // result should not contain 'array' field
    // const keys = Object.keys(query.data[0]);
    // expect(keys.length).toEqual(3);
    // expect(keys.includes('array')).toBeFalsy();
  });

  it(`search should be successful`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: [1, 2, 3, 4],
    });
    expectSuccess(search.status);
  });

  it(`search nq > 1 should be successful`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ],
    });
    expectSuccess(search.status);
    expect(search.results.length).toEqual(2);
    expect(search.results[0].length).toEqual(10);
    expect(search.results[1].length).toEqual(10);
  });

  it(`release and drop should be successful`, async () => {
    // releases
    const release = await milvusClient.releaseCollection({
      collection_name: COLLECTION_NAME,
      timeout: 15000,
    });
    expectSuccess(release);

    // drop
    const drop = await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(drop);
  });
});
