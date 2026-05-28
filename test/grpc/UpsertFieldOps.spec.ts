import {
  DataType,
  ErrorCode,
  FieldPartialUpdateOpType,
  MilvusClient,
  UpsertReq,
} from '../../milvus';
import { GENERATE_NAME, VECTOR_FIELD_NAME, IP } from '../tools';

const MILVUS_ADDRESS = IP || '127.0.0.1:39530';
const MILVUS_TOKEN = process.env.MILVUS_TOKEN || 'root:Milvus';
const COLLECTION_NAME = GENERATE_NAME();

describe('Upsert field_ops API', () => {
  let milvusClient: MilvusClient;

  beforeAll(async () => {
    milvusClient = new MilvusClient({
      address: MILVUS_ADDRESS,
      token: MILVUS_TOKEN,
      logLevel: 'info',
    });

    const create = await milvusClient.createCollection({
      collection_name: COLLECTION_NAME,
      consistency_level: 'Strong',
      fields: [
        {
          name: VECTOR_FIELD_NAME,
          description: 'vector field',
          data_type: DataType.FloatVector,
          dim: 4,
        },
        {
          name: 'id',
          description: 'ID field',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: false,
        },
        {
          name: 'tags',
          description: 'tags array field',
          data_type: DataType.Array,
          element_type: DataType.VarChar,
          max_capacity: 16,
          max_length: 64,
        },
        {
          name: 'score',
          description: 'score field',
          data_type: DataType.Int32,
        },
      ],
    });
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const index = await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'AUTOINDEX',
        metric_type: 'L2',
      },
    });
    expect(index.error_code).toEqual(ErrorCode.SUCCESS);

    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });

    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      fields_data: [
        {
          id: 1,
          [VECTOR_FIELD_NAME]: [0.1, 0.2, 0.3, 0.4],
          tags: ['base', 'deprecated'],
          score: 7,
        },
        {
          id: 2,
          [VECTOR_FIELD_NAME]: [0.2, 0.3, 0.4, 0.5],
          tags: ['x'],
          score: 8,
        },
      ],
    });
    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    milvusClient.closeConnection();
  });

  it('should append and remove array values with field_ops', async () => {
    const append = await milvusClient.upsert({
      collection_name: COLLECTION_NAME,
      fields_data: [
        { id: 1, tags: ['new1', 'new2'] },
        { id: 2, tags: ['new3'] },
      ],
      field_ops: [
        {
          field_name: 'tags',
          op: FieldPartialUpdateOpType.ARRAY_APPEND,
        },
      ],
    });
    expect(append.status.error_code).toEqual(ErrorCode.SUCCESS);

    const remove = await milvusClient.upsert({
      collection_name: COLLECTION_NAME,
      fields_data: [{ id: 1, tags: ['deprecated'] }],
      field_ops: [
        {
          field_name: 'tags',
          op: 'ARRAY_REMOVE',
        },
      ],
    });
    expect(remove.status.error_code).toEqual(ErrorCode.SUCCESS);

    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: 'id in [1, 2]',
      output_fields: ['id', 'tags', 'score'],
    });
    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);

    const rows = query.data.sort((a: any, b: any) => a.id - b.id);
    expect(rows).toEqual([
      {
        id: '1',
        tags: ['base', 'new1', 'new2'],
        score: 7,
      },
      {
        id: '2',
        tags: ['x', 'new3'],
        score: 8,
      },
    ]);
  });

  it('should serialize field_ops and promote the request to partial_update', async () => {
    const fakeClient = new MilvusClient({
      address: MILVUS_ADDRESS,
      token: MILVUS_TOKEN,
    });
    let upsertParams: any;

    fakeClient.describeCollection = () => {
      return new Promise(res => {
        res({
          status: {
            error_code: ErrorCode.SUCCESS,
            reason: '',
          },
          schema: {
            enable_dynamic_field: false,
            fields: [
              {
                name: 'id',
                data_type: DataType.Int64,
                element_type: DataType.None,
                is_primary_key: true,
                autoID: false,
              },
              {
                name: 'tags',
                data_type: DataType.Array,
                element_type: DataType.VarChar,
              },
              {
                name: 'score',
                data_type: DataType.Int32,
                element_type: DataType.None,
              },
            ],
          },
          properties: [
            {
              key: 'allow_insert_auto_id',
              value: 'false',
            },
          ],
        } as any);
      });
    };

    (fakeClient as any).channelPool = {
      acquire: () =>
        Promise.resolve({
          Upsert: (params: any, _options: any, callback: Function) => {
            upsertParams = params;
            callback(null, {
              status: {
                error_code: ErrorCode.SUCCESS,
                reason: '',
              },
            });
          },
        }),
      release: jest.fn(),
      drain: jest.fn(),
      clear: jest.fn(),
    };

    const params: UpsertReq = {
      collection_name: COLLECTION_NAME,
      fields_data: [{ id: 1, tags: ['new'] }],
      field_ops: [
        {
          field_name: 'tags',
          op: FieldPartialUpdateOpType.ARRAY_APPEND,
        },
      ],
    };

    const res = await fakeClient.upsert(params);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(upsertParams.partial_update).toBe(true);
    expect(upsertParams.field_ops).toEqual([
      {
        field_name: 'tags',
        op: 'ARRAY_APPEND',
      },
    ]);
    expect(upsertParams.fields_data.map((f: any) => f.field_name)).toEqual([
      'id',
      'tags',
    ]);

    fakeClient.closeConnection();
  });
});
