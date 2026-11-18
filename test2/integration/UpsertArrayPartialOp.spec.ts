import { createClient } from '../support/client';
import { expectSuccess } from '../support/assertions';
import {
  ConsistencyLevelEnum,
  DataType,
  ErrorCode,
  FieldPartialUpdateOpType,
  HttpClient,
} from '../../milvus';
import { GENERATE_NAME, IP, VECTOR_FIELD_NAME } from '../fixtures';

const milvusClient = createClient({
  address: IP,
  logLevel: 'info',
});

const COLLECTION_NAME = GENERATE_NAME();

describe('Upsert array partial ops', () => {
  beforeAll(async () => {
    await milvusClient.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
        },
        {
          name: VECTOR_FIELD_NAME,
          data_type: DataType.FloatVector,
          dim: 4,
        },
        {
          name: 'tags',
          data_type: DataType.Array,
          element_type: DataType.VarChar,
          max_capacity: 8,
          max_length: 32,
        },
        {
          name: 'scores',
          data_type: DataType.Array,
          element_type: DataType.Int64,
          max_capacity: 8,
        },
        { name: 'attributes', data_type: DataType.JSON, nullable: true },
        {
          name: 'items',
          data_type: DataType.Array,
          element_type: DataType.Struct,
          max_capacity: 4,
          nullable: true,
          fields: [
            { name: 'label', data_type: DataType.VarChar, max_length: 32 },
            { name: 'rank', data_type: DataType.Int32 },
          ],
        },
      ],
    });

    await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'AUTOINDEX',
        metric_type: 'L2',
      },
    });

    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      fields_data: [
        {
          id: 1,
          [VECTOR_FIELD_NAME]: [0.1, 0.2, 0.3, 0.4],
          tags: ['red', 'green'],
          scores: [1, 2, 3],
        },
        {
          id: 2,
          [VECTOR_FIELD_NAME]: [0.2, 0.3, 0.4, 0.5],
          tags: ['blue'],
          scores: [10, 20],
        },
        {
          id: 3,
          [VECTOR_FIELD_NAME]: [0.1, 0.2, 0.3, 0.4],
          tags: ['red', 'green'],
          scores: [3, 4],
          attributes: { nested: { color: 'green', size: 2 } },
          items: [
            { label: 'green', rank: 1 },
            { label: 'red', rank: 2 },
          ],
        },
        {
          id: 4,
          [VECTOR_FIELD_NAME]: [0.1, 0.2, 0.3, 0.4],
          tags: ['red', 'green'],
          scores: [3, 4],
        },
      ],
    });
    expectSuccess(insert.status);

    await milvusClient.flushSync({ collection_names: [COLLECTION_NAME] });
    await milvusClient.loadCollectionSync({ collection_name: COLLECTION_NAME });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    milvusClient.closeConnection();
  });

  it('should append array values and auto-enable partial update', async () => {
    const upsert = await milvusClient.upsert({
      collection_name: COLLECTION_NAME,
      fields_data: [
        { id: 1, tags: ['blue'], scores: [4, 5] },
        { id: 2, tags: ['yellow', 'purple'], scores: [30] },
      ],
      field_ops: [
        { field_name: 'tags', op: FieldPartialUpdateOpType.ARRAY_APPEND },
        { field_name: 'scores', op: 'ARRAY_APPEND' },
      ],
    });
    expect(upsert.status).toEqual({
      ...upsert.status,
      error_code: ErrorCode.SUCCESS,
    });

    await milvusClient.flushSync({ collection_names: [COLLECTION_NAME] });

    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: 'id in [1, 2]',
      output_fields: ['id', 'tags', 'scores'],
    });
    expectSuccess(query.status);

    const rows = [...query.data].sort((a: any, b: any) => a.id - b.id);
    expect(rows[0].tags).toEqual(['red', 'green', 'blue']);
    expect(rows[0].scores).toEqual(['1', '2', '3', '4', '5']);
    expect(rows[1].tags).toEqual(['blue', 'yellow', 'purple']);
    expect(rows[1].scores).toEqual(['10', '20', '30']);
  });

  it('should remove array values with field_ops', async () => {
    const upsert = await milvusClient.upsert({
      collection_name: COLLECTION_NAME,
      fields_data: [{ id: 1, tags: ['green'], scores: [2, 5] }],
      field_ops: [
        { field_name: 'tags', op: FieldPartialUpdateOpType.ARRAY_REMOVE },
        { field_name: 'scores', op: 'ARRAY_REMOVE' },
      ],
    });
    expect(upsert.status).toEqual({
      ...upsert.status,
      error_code: ErrorCode.SUCCESS,
    });

    await milvusClient.flushSync({ collection_names: [COLLECTION_NAME] });

    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: 'id == 1',
      output_fields: ['id', 'tags', 'scores'],
    });
    expectSuccess(query.status);
    expect(query.data[0].tags).toEqual(['red', 'blue']);
    expect(query.data[0].scores).toEqual(['1', '3', '4']);
  });

  it('replaces Array, JSON, and StructArray values at their paths over gRPC', async () => {
    const upsert = await milvusClient.upsert({
      collection_name: COLLECTION_NAME,
      data: [
        { id: 3, scores: [9], attributes: null, items: [{ label: 'blue' }] },
      ],
      field_ops: [
        {
          field_name: 'scores',
          op: FieldPartialUpdateOpType.PATH_REPLACE,
          path: '[1]',
        },
        {
          field_name: 'attributes',
          op: 'PATH_REPLACE',
          path: '["nested"]["color"]',
        },
        { field_name: 'items', op: 'PATH_REPLACE', path: '[0][label]' },
      ],
    });
    expectSuccess(upsert.status);

    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'id == 3',
      output_fields: ['scores', 'attributes', 'items'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });
    expectSuccess(query.status);
    expect(query.data).toHaveLength(1);
    expect(query.data[0]).toMatchObject({
      scores: ['3', '9'],
      attributes: { nested: { color: null, size: 2 } },
      items: [
        { label: 'blue', rank: 1 },
        { label: 'red', rank: 2 },
      ],
    });
  });

  it('replaces an Array element through the typed REST upsert method', async () => {
    const httpClient = new HttpClient({ endpoint: `http://${IP}` });
    const upsert = await httpClient.upsert({
      collectionName: COLLECTION_NAME,
      data: [{ id: 4, tags: ['yellow'] }],
      fieldOps: [{ fieldName: 'tags', op: 'PATH_REPLACE', path: '[0]' }],
    });
    expect(upsert).toMatchObject({ code: 0, data: { upsertCount: 1 } });

    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'id == 4',
      output_fields: ['tags'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });
    expectSuccess(query.status);
    expect(query.data[0].tags).toEqual(['yellow', 'green']);
  });
});
