import {
  DataType,
  ErrorCode,
  FieldPartialUpdateOpType,
  MilvusClient,
} from '../../milvus';
import { GENERATE_NAME, IP, VECTOR_FIELD_NAME } from '../tools';

const milvusClient = new MilvusClient({
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
      ],
    });
    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);

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
    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);

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
    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(query.data[0].tags).toEqual(['red', 'blue']);
    expect(query.data[0].scores).toEqual(['1', '3', '4']);
  });
});
