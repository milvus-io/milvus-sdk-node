import { MilvusClient, ErrorCode, DataType, FieldType } from '../../milvus';
import { IP, GENERATE_NAME, generateInsertData } from '../tools';

const milvusClient = new MilvusClient({
  address: IP,
  logLevel: 'debug',
  logPrefix: 'Basic API',
});
const COLLECTION_NAME = GENERATE_NAME();
const schema: FieldType[] = [
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

const schemaToAdd: FieldType[] = [
  {
    name: 'new_varChar',
    description: 'new VarChar field',
    data_type: DataType.VarChar,
    max_length: 128,
    is_partition_key: false,
    nullable: true,
    default_value: 'default',
  },

  {
    name: 'new_array',
    description: 'new array field',
    data_type: DataType.Array,
    element_type: DataType.VarChar,
    max_capacity: 128,
    max_length: 128,
    nullable: true,
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

  it(`Describe collection should be successful`, async () => {
    const desc = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(desc.schema.fields.length).toEqual(schema.length);
    expect(desc.schema.fields[0].name).toEqual('vector');
    expect(desc.schema.fields[1].name).toEqual('id');
    expect(desc.schema.fields[2].name).toEqual('varChar');
    expect(desc.schema.fields[3].name).toEqual('array');
    // test primary key
    expect(desc.schema.fields[1].is_primary_key).toEqual(true);
    // test partition key
    expect(desc.schema.fields[2].is_partition_key).toEqual(false);
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
      data: [1, 2, 3, 4],
    });
    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`search nq > 1 should be successful`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ],
    });
    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
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
    expect(release.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`add field should be successful`, async () => {
    const addVarChar = await milvusClient.addCollectionField({
      collection_name: COLLECTION_NAME,
      field: schemaToAdd[0],
    });
    expect(addVarChar.error_code).toEqual(ErrorCode.SUCCESS);

    const addArray = await milvusClient.addCollectionField({
      collection_name: COLLECTION_NAME,
      field: schemaToAdd[1],
    });
    expect(addArray.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(describe.schema.fields.length).toEqual(
      schema.length + schemaToAdd.length
    );
    expect(describe.schema.fields[4].name).toEqual('new_varChar');
    expect(describe.schema.fields[5].name).toEqual('new_array');
  });

  it(`insert data with new field should be successful`, async () => {
    const data = generateInsertData([...schema, ...schemaToAdd]);
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data,
    });
    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`load collection with new field should be successful`, async () => {
    const load = await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`query with new field should be successful`, async () => {
    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: `id > 0`,
      output_fields: ['new_varChar', 'new_array'],
    });
    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(query.data[0].length).toEqual(2);
  });

  it(`search with new field should be successful`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: [1, 2, 3, 4],
      output_fields: ['new_varChar', 'new_array'],
    });
    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results[0].length).toEqual(2);
  });

  it(`release again should be successful`, async () => {
    const release = await milvusClient.releaseCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(release.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`drop should be successful`, async () => {
    // drop
    const drop = await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(drop.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
