import { MilvusClient, ErrorCode, DataType } from '../milvus';
import { IP, GENERATE_NAME, generateInsertData } from './tools';

const milvusClient = new MilvusClient({ address: IP });
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
];

describe(`Basic API without database`, () => {
  it(`Create collection should be successful`, async () => {
    const res = await milvusClient.createCollection({
      collection_name: COLLECTION_NAME,
      fields: schema,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
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
    expect(index.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`load collection should be successful`, async () => {
    const load = await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`insert data should be successful`, async () => {
    const data = generateInsertData(schema);
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data,
    });
    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`query should be successful`, async () => {
    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: `id > 0`,
    });
    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`search should be successful`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      vector: [1, 2, 3, 4],
    });
    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`release and drop should be successful`, async () => {
    // releases
    const release = await milvusClient.releaseCollection({
      collection_name: COLLECTION_NAME,
      timeout: 15000,
    });
    expect(release.error_code).toEqual(ErrorCode.SUCCESS);

    // drop
    const drop = await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(drop.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
