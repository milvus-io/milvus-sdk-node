import { createClient } from '../support/client';
import { expectSuccess } from '../support/assertions';
import {
  MilvusClient,
  ErrorCode,
  DataType,
  FieldType,
  newClientRequestId,
} from '../../milvus';
import { IP, GENERATE_NAME, generateInsertData } from '../fixtures';

const milvusClient = createClient({
  address: IP,
  logLevel: 'info',
  logPrefix: 'Basic API',
});
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const hasField = async (fieldName: string) => {
  const describe = await milvusClient.describeCollection({
    collection_name: COLLECTION_NAME,
  });

  return describe.schema.fields.some(field => field.name === fieldName);
};

const addCollectionFieldAndWait = async (field: FieldType) => {
  let res = await milvusClient.addCollectionField({
    collection_name: COLLECTION_NAME,
    field,
  });

  for (let i = 0; i < 10; i++) {
    if (res.error_code === ErrorCode.SUCCESS) {
      return res;
    }

    if (
      (res.error_code === 'NotReadyServe' ||
        res.reason?.includes('duplicated field name')) &&
      (await hasField(field.name))
    ) {
      return { error_code: ErrorCode.SUCCESS, reason: '' };
    }

    await sleep(1000);
    res = await milvusClient.addCollectionField({
      collection_name: COLLECTION_NAME,
      field,
    });
  }

  return res;
};
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
    ['mmap.enabled']: true,
  },
];

const fieldsToAdd: FieldType[] = [
  {
    name: 'new_varChar2',
    description: 'new VarChar field',
    data_type: DataType.VarChar,
    max_length: 128,
    is_partition_key: false,
    nullable: true,
    default_value: 'default',
  },

  {
    name: 'new_array2',
    description: 'new array field',
    data_type: DataType.Array,
    element_type: DataType.VarChar,
    max_capacity: 128,
    max_length: 128,
    nullable: true,
    is_partition_key: false,
    ['mmap.enabled']: true,
  },
];

const wrongFieldsToAdd: FieldType[] = [
  {
    name: 'new_array2',
    description: 'new array field',
    data_type: DataType.Array,
    element_type: DataType.VarChar,
    max_capacity: 128,
    max_length: 128,
    nullable: false,
    is_partition_key: false,
    ['mmap.enabled']: true,
  },
];

const dbParam = {
  db_name: 'Basic_API',
};

describe(`Basic API without database`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create collection should be successful`, async () => {
    const res = await milvusClient.createCollection({
      collection_name: COLLECTION_NAME,
      fields: schema,
    });
    expectSuccess(res);
  });

  it(`Create collection with traceid should be successful`, async () => {
    const traceId = newClientRequestId();
    const res = await milvusClient.createCollection({
      collection_name: COLLECTION_NAME + '_trace',
      fields: schema,
      client_request_id: traceId,
    });
    expectSuccess(res);
  });

  it(`Create collection with traceid (alternative format) should be successful`, async () => {
    const traceId = newClientRequestId();
    const res = await milvusClient.createCollection({
      collection_name: COLLECTION_NAME + '_trace_alt',
      fields: schema,
      'client-request-id': traceId,
    });
    expectSuccess(res);
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
    expectSuccess(index);
  });

  it(`load collection should be successful`, async () => {
    const load = await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
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
    });
    expectSuccess(query.status);
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
  });

  it(`add field should be successful`, async () => {
    const addVarChar = await milvusClient.addCollectionField({
      collection_name: COLLECTION_NAME,
      field: schemaToAdd[0],
    });
    expectSuccess(addVarChar);

    const addArray = await milvusClient.addCollectionField({
      collection_name: COLLECTION_NAME,
      field: schemaToAdd[1],
    });
    expectSuccess(addArray);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(describe.schema.fields.length).toEqual(
      schema.length + schemaToAdd.length
    );
    expect(describe.schema.fields[4].name).toEqual('new_varChar');
    expect(describe.schema.fields[5].name).toEqual('new_array');
  });

  it(`load collection with new field should be successful`, async () => {
    const load = await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(load);
  });

  it(`query with new field should be successful, data should be null`, async () => {
    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: `id > 0`,
      output_fields: ['new_varChar', 'new_array'],
      limit: 10,
    });

    expectSuccess(query.status);
    expect(Object.keys(query.data[0])).toContain('new_varChar');
    expect(Object.keys(query.data[0])).toContain('new_array');
    expect(query.data[0].new_varChar).toBe('default');
    expect(query.data[0].new_array).toBeNull();
  });

  it(`insert data with new field should be successful`, async () => {
    const data = generateInsertData([...schema, ...schemaToAdd]);
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data,
    });
    expectSuccess(insert.status);
  });

  it(`query with new field should be successful`, async () => {
    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: `id > 0`,
      output_fields: ['new_varChar', 'new_array'],
    });

    expectSuccess(query.status);
    expect(Object.keys(query.data[0])).toContain('new_varChar');
    expect(Object.keys(query.data[0])).toContain('new_array');
  });

  it(`search with new field should be successful`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: [1, 2, 3, 4],
      output_fields: ['new_varChar', 'new_array'],
    });

    expectSuccess(search.status);
    expect(Object.keys(search.results[0])).toContain('new_varChar');
    expect(Object.keys(search.results[0])).toContain('new_array');
  });

  it(`add fields should be successful`, async () => {
    const release = await milvusClient.releaseCollection({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(release);

    const addVarChar = await addCollectionFieldAndWait(fieldsToAdd[0]);
    expectSuccess(addVarChar);

    const addArray = await addCollectionFieldAndWait(fieldsToAdd[1]);
    expectSuccess(addArray);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(describe.schema.fields.length).toEqual(
      schema.length + schemaToAdd.length + fieldsToAdd.length
    );
    expect(describe.schema.fields[6].name).toEqual('new_varChar2');
    expect(describe.schema.fields[7].name).toEqual('new_array2');

    const load = await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(load);
  });

  it('add wrong fields should be failed', async () => {
    const release = await milvusClient.releaseCollection({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(release);

    let addWrongFields = await milvusClient.addCollectionFields({
      collection_name: COLLECTION_NAME,
      fields: wrongFieldsToAdd,
    });

    for (
      let i = 0;
      addWrongFields.error_code === 'NotReadyServe' && i < 10;
      i++
    ) {
      await sleep(1000);
      addWrongFields = await milvusClient.addCollectionFields({
        collection_name: COLLECTION_NAME,
        fields: wrongFieldsToAdd,
      });
    }

    expect(addWrongFields.error_code).toEqual(ErrorCode.IllegalArgument);

    const load = await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(load);
  });

  it(`search with ids should be successful`, async () => {
    // 1. describe collection to get primary key and check if "autoID" is true
    const desc = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });
    const pk = desc.schema.fields.find(f => f.is_primary_key);
    expect(pk).toBeDefined();

    // 2. if autoID is true, random query some ids
    let searchIds: any[] = [];
    if (pk?.autoID) {
      const query = await milvusClient.query({
        collection_name: COLLECTION_NAME,
        expr: `${pk.name} > 0`,
        limit: 5,
        output_fields: [pk.name],
      });
      expectSuccess(query.status);
      expect(query.data.length).toBeGreaterThan(0);
      searchIds = query.data.map(d => d[pk.name]);
    } else {
      // if not autoID, we can just use some static ids or generate them
      // but provided schema has autoID: true
    }

    // 3. search with ids
    if (searchIds.length > 0) {
      const search = await milvusClient.search({
        collection_name: COLLECTION_NAME,
        ids: searchIds,
      });

      expectSuccess(search.status);
      expect(search.results.length).toEqual(searchIds.length);
    }
  });

  it(`release again should be successful`, async () => {
    const release = await milvusClient.releaseCollection({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(release);
  });

  it(`drop should be successful`, async () => {
    // drop
    const drop = await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(drop);
  });
});

describe('Search by String IDs API testing', () => {
  const COLLECTION_NAME_STRING = 'BasicCollectionString';

  beforeAll(async () => {
    // Create collection with VarChar Primary Key
    await milvusClient.createCollection({
      collection_name: COLLECTION_NAME_STRING,
      dimension: 4,
      fields: [
        {
          name: 'vector',
          description: 'Vector field',
          data_type: DataType.FloatVector,
          dim: 4,
        },
        {
          name: 'id_str',
          description: 'String ID field',
          data_type: DataType.VarChar,
          is_primary_key: true,
          max_length: 64,
          autoID: false, // Manual string IDs
        },
      ],
    });

    // Insert data with string IDs
    const data = [
      { id_str: 'id_1', vector: [1, 2, 3, 4] },
      { id_str: 'id_2', vector: [5, 6, 7, 8] },
      { id_str: 'id_3', vector: [1, 2, 3, 4] },
      { id_str: 'id_4', vector: [5, 6, 7, 8] },
    ];

    await milvusClient.insert({
      collection_name: COLLECTION_NAME_STRING,
      data: data,
    });

    // Create index (required for load/search)
    await milvusClient.createIndex({
      collection_name: COLLECTION_NAME_STRING,
      field_name: 'vector',
      metric_type: 'L2',
      index_type: 'IVF_FLAT',
      params: { nlist: 1024 },
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME_STRING,
    });
  });

  it(`search with string ids should be successful`, async () => {
    // Load collection first
    await milvusClient.loadCollection({
      collection_name: COLLECTION_NAME_STRING,
    });

    const searchIds = ['id_1', 'id_3'];
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME_STRING,
      ids: searchIds,
      output_fields: ['id_str'],
    });

    expectSuccess(search.status);
    expect(search.results.length).toEqual(searchIds.length);

    // Check if results match
    // search.results is a 2D array: results[query_index][result_index]
    // Since id_1 and id_3 have identical vectors, they both match each other with score 0.
    // Order is not guaranteed, so we check using toContain.
    expect(search.results[0].map((r: any) => r.id_str)).toContain('id_1');
    expect(search.results[1].map((r: any) => r.id_str)).toContain('id_3');
  });

  it(`search with number ids should fail for VarChar PK`, async () => {
    await expect(
      milvusClient.search({
        collection_name: COLLECTION_NAME_STRING,
        ids: [1, 3], // Invalid for VarChar PK
      })
    ).rejects.toThrow(
      'The type of ids should be string because the primary key field id_str is VarChar.'
    );
  });
});
