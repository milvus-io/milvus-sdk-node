import { status as grpcStatus } from '@grpc/grpc-js';
import {
  DataType,
  DEFAULT_DB,
  ErrorCode,
  ERROR_REASONS,
  FunctionType,
  getGRPCService,
  IndexType,
  LOADER_OPTIONS,
  MilvusClient,
  ResStatus,
} from '../../milvus';

type RpcCallback = (error: any, response?: any) => void;

const COLLECTION_NAME = 'schema_alter_collection';

const successStatus: ResStatus = {
  error_code: ErrorCode.SUCCESS,
  reason: '',
  code: 0,
  extra_info: {},
  retriable: false,
  detail: '',
};

const failedStatus: ResStatus = {
  error_code: ErrorCode.UnexpectedError,
  reason: 'schema alteration failed',
  code: 1,
  extra_info: {},
  retriable: false,
  detail: '',
};

const respondWith =
  (response: any) => (_request: any, _options: any, callback: RpcCallback) =>
    callback(null, response);

const failWith =
  (error: any) => (_request: any, _options: any, callback: RpcCallback) =>
    callback(error);

const createTestClient = () => {
  const rpcClient = {
    AlterCollectionSchema: jest.fn(),
    AddCollectionField: jest.fn(),
    AddCollectionFunction: jest.fn(),
    DropCollectionFunction: jest.fn(),
    DropCollection: jest.fn(),
    DescribeCollection: jest.fn(),
  };
  const channelPool = {
    acquire: jest.fn().mockResolvedValue(rpcClient),
    release: jest.fn(),
  };
  const client = new MilvusClient({
    address: 'localhost:19530',
    __SKIP_CONNECT__: true,
  });
  (client as any).channelPool = channelPool;

  return { client, rpcClient, channelPool };
};

const cacheKey = (dbName = DEFAULT_DB) => `${dbName}:${COLLECTION_NAME}`;

const seedCollectionCache = (client: MilvusClient, dbName = DEFAULT_DB) => {
  const cache = (client as any).collectionInfoCache;
  cache.set(cacheKey(dbName), { cached: true });
  return cache;
};

const bm25Function = {
  name: 'bm25_function',
  type: FunctionType.BM25,
  input_field_names: ['text'],
  output_field_names: ['sparse_vector'],
  params: { analyzer: 'standard' },
};

describe('collection schema alteration', () => {
  describe('addCollectionField', () => {
    it('uses AlterCollectionSchema and evicts the schema cache on success', async () => {
      const { client, rpcClient } = createTestClient();
      rpcClient.AlterCollectionSchema.mockImplementation(
        respondWith({ alter_status: successStatus })
      );
      const cache = seedCollectionCache(client, 'db1');

      const result = await client.addCollectionField({
        collection_name: COLLECTION_NAME,
        db_name: 'db1',
        client_request_id: 'request-1',
        field: {
          name: 'age',
          data_type: DataType.Int64,
          nullable: true,
          default_value: 42,
        },
      });

      expect(result).toEqual(successStatus);
      expect(rpcClient.AlterCollectionSchema).toHaveBeenCalledTimes(1);
      expect(rpcClient.AddCollectionField).not.toHaveBeenCalled();
      const alterRequest = rpcClient.AlterCollectionSchema.mock.calls[0][0];
      expect(alterRequest).toEqual(
        expect.objectContaining({
          collection_name: COLLECTION_NAME,
          db_name: 'db1',
          action: {
            add_request: {
              field_infos: [
                {
                  field_schema: expect.objectContaining({
                    name: 'age',
                    data_type: DataType.Int64,
                    nullable: true,
                    default_value: { long_data: 42 },
                  }),
                },
              ],
            },
          },
        })
      );
      const service = getGRPCService(
        { serviceName: 'milvus.proto.milvus.MilvusService' },
        LOADER_OPTIONS
      ) as any;
      const alterMethod = service.service.AlterCollectionSchema;
      const serializedRequest = alterMethod.requestDeserialize(
        alterMethod.requestSerialize(alterRequest)
      );
      expect(
        serializedRequest.action.add_request.field_infos[0].field_schema
          .default_value
      ).toEqual(expect.objectContaining({ long_data: '42' }));
      expect(
        rpcClient.AlterCollectionSchema.mock.calls[0][1].metadata.get(
          'client-request-id'
        )
      ).toEqual(['request-1']);
      expect(cache.has(cacheKey('db1'))).toBe(false);
    });

    it('uses the explicit database name consistently for describe and invalidation', async () => {
      const { client, rpcClient } = createTestClient();
      rpcClient.DescribeCollection.mockImplementation(
        respondWith({
          status: successStatus,
          collection_name: COLLECTION_NAME,
          schema: { fields: [], struct_array_fields: [], functions: [] },
        })
      );
      rpcClient.AlterCollectionSchema.mockImplementation(
        respondWith({ alter_status: successStatus })
      );

      await client.describeCollection({
        collection_name: COLLECTION_NAME,
        db_name: 'db1',
        cache: false,
      });
      const cache = (client as any).collectionInfoCache;
      expect(cache.has(cacheKey('db1'))).toBe(true);
      expect(cache.has(cacheKey())).toBe(false);

      await client.addCollectionField({
        collection_name: COLLECTION_NAME,
        db_name: 'db1',
        field: { name: 'age', data_type: DataType.Int64, nullable: true },
      });
      expect(cache.has(cacheKey('db1'))).toBe(false);
    });

    it('falls back to AddCollectionField only for UNIMPLEMENTED', async () => {
      const { client, rpcClient } = createTestClient();
      rpcClient.AlterCollectionSchema.mockImplementation(
        failWith({ code: grpcStatus.UNIMPLEMENTED, details: 'not implemented' })
      );
      rpcClient.AddCollectionField.mockImplementation(
        respondWith(successStatus)
      );
      const cache = seedCollectionCache(client);
      const defaultValue = '2024-01-15T10:30:00Z';
      const field = {
        name: 'event_time',
        data_type: DataType.Timestamptz,
        nullable: true,
        default_value: defaultValue,
      };

      const result = await client.addCollectionField({
        collection_name: COLLECTION_NAME,
        field,
      });

      expect(result).toEqual(successStatus);
      expect(rpcClient.AlterCollectionSchema).toHaveBeenCalledTimes(1);
      expect(rpcClient.AddCollectionField).toHaveBeenCalledTimes(1);
      const legacyRequest = rpcClient.AddCollectionField.mock.calls[0][0];
      expect(legacyRequest).toEqual(
        expect.objectContaining({ collection_name: COLLECTION_NAME })
      );
      expect(legacyRequest.schema).toBeInstanceOf(Uint8Array);
      const fieldSchemaType = (client as any).schemaProto.lookupType(
        (client as any).protoInternalPath.fieldSchema
      );
      const decoded = fieldSchemaType.toObject(
        fieldSchemaType.decode(legacyRequest.schema),
        { longs: String }
      );
      expect(decoded.defaultValue).toEqual({
        timestamptzData: (new Date(defaultValue).getTime() * 1000).toString(),
      });
      expect(field.default_value).toBe(defaultValue);
      expect(cache.has(cacheKey())).toBe(false);
    });

    it('does not fall back for non-UNIMPLEMENTED transport errors', async () => {
      const { client, rpcClient } = createTestClient();
      const permissionError = {
        code: grpcStatus.PERMISSION_DENIED,
        details: 'permission denied',
      };
      rpcClient.AlterCollectionSchema.mockImplementation(
        failWith(permissionError)
      );
      const cache = seedCollectionCache(client);

      await expect(
        client.addCollectionField({
          collection_name: COLLECTION_NAME,
          field: { name: 'age', data_type: DataType.Int64, nullable: true },
        })
      ).rejects.toBe(permissionError);

      expect(rpcClient.AddCollectionField).not.toHaveBeenCalled();
      expect(cache.has(cacheKey())).toBe(true);
    });

    it('returns AlterCollectionSchema business failures without fallback or cache eviction', async () => {
      const { client, rpcClient } = createTestClient();
      rpcClient.AlterCollectionSchema.mockImplementation(
        respondWith({ alter_status: failedStatus })
      );
      const cache = seedCollectionCache(client);

      const result = await client.addCollectionField({
        collection_name: COLLECTION_NAME,
        field: { name: 'age', data_type: DataType.Int64, nullable: true },
      });

      expect(result).toEqual(failedStatus);
      expect(rpcClient.AddCollectionField).not.toHaveBeenCalled();
      expect(cache.has(cacheKey())).toBe(true);
    });

    it('propagates legacy RPC errors and preserves the cache', async () => {
      const { client, rpcClient } = createTestClient();
      const legacyError = {
        code: grpcStatus.INTERNAL,
        details: 'legacy add field failed',
      };
      rpcClient.AlterCollectionSchema.mockImplementation(
        failWith({ code: grpcStatus.UNIMPLEMENTED })
      );
      rpcClient.AddCollectionField.mockImplementation(failWith(legacyError));
      const cache = seedCollectionCache(client);

      await expect(
        client.addCollectionField({
          collection_name: COLLECTION_NAME,
          field: { name: 'age', data_type: DataType.Int64, nullable: true },
        })
      ).rejects.toBe(legacyError);

      expect(rpcClient.AddCollectionField).toHaveBeenCalledTimes(1);
      expect(cache.has(cacheKey())).toBe(true);
    });

    it.each([DataType.FloatVector, DataType.BinaryVector])(
      'rejects non-nullable vector field type %s before sending an RPC',
      async dataType => {
        const { client, rpcClient } = createTestClient();

        await expect(
          client.addCollectionField({
            collection_name: COLLECTION_NAME,
            field: {
              name: 'vector',
              data_type: dataType,
              dim: 8,
            },
          })
        ).rejects.toThrow(
          ERROR_REASONS.ADD_COLLECTION_FIELD_VECTOR_NULLABLE_REQUIRED
        );

        expect(rpcClient.AlterCollectionSchema).not.toHaveBeenCalled();
        expect(rpcClient.AddCollectionField).not.toHaveBeenCalled();
      }
    );
  });

  describe('dropCollectionField', () => {
    it.each([
      [
        'name',
        { field_name: 'obsolete_field' },
        { field_name: 'obsolete_field' },
      ],
      ['ID', { field_id: '101' }, { field_id: '101' }],
      [
        'ID with an undefined name',
        { field_name: undefined, field_id: '101' },
        { field_id: '101' },
      ],
    ])('drops a field by %s', async (_mode, identifier, dropRequest) => {
      const { client, rpcClient } = createTestClient();
      rpcClient.AlterCollectionSchema.mockImplementation(
        respondWith({ alter_status: successStatus })
      );
      const cache = seedCollectionCache(client);

      const result = await client.dropCollectionField({
        collection_name: COLLECTION_NAME,
        ...identifier,
      } as any);

      expect(result).toEqual(successStatus);
      expect(rpcClient.AlterCollectionSchema.mock.calls[0][0]).toEqual({
        collection_name: COLLECTION_NAME,
        action: { drop_request: dropRequest },
      });
      expect(cache.has(cacheKey())).toBe(false);
    });

    it.each([
      {},
      { field_name: 'field', field_id: 101 },
      { field_name: '' },
      { field_id: 0 },
      { field_id: -1 },
      { field_id: 1.5 },
      { field_id: Number.MAX_SAFE_INTEGER + 1 },
      { field_id: 'not-an-id' },
      { field_id: '9223372036854775808' },
    ])('rejects invalid field identifier %#', async identifier => {
      const { client, rpcClient } = createTestClient();

      await expect(
        client.dropCollectionField({
          collection_name: COLLECTION_NAME,
          ...identifier,
        } as any)
      ).rejects.toThrow(
        ERROR_REASONS.DROP_COLLECTION_FIELD_IDENTIFIER_IS_REQUIRED
      );

      expect(rpcClient.AlterCollectionSchema).not.toHaveBeenCalled();
    });
  });

  describe('function fields', () => {
    it('serializes a BM25 function field and its bound index parameters', async () => {
      const { client, rpcClient } = createTestClient();
      rpcClient.AlterCollectionSchema.mockImplementation(
        respondWith({ alter_status: successStatus })
      );

      const result = await client.addFunctionField({
        collection_name: COLLECTION_NAME,
        field: {
          name: 'sparse_vector',
          data_type: DataType.SparseFloatVector,
          is_function_output: true,
        },
        function: bm25Function,
        index_name: 'sparse_index',
        extra_params: {
          index_type: IndexType.SPARSE_INVERTED_INDEX,
          metric_type: 'BM25',
          params: { inverted_index_algo: 'DAAT_MAXSCORE', bm25_k1: 1.2 },
        },
      });

      expect(result).toEqual(successStatus);
      const addRequest =
        rpcClient.AlterCollectionSchema.mock.calls[0][0].action.add_request;
      expect(addRequest.field_infos[0]).toEqual(
        expect.objectContaining({
          index_name: 'sparse_index',
          field_schema: expect.objectContaining({
            name: 'sparse_vector',
            data_type: DataType.SparseFloatVector,
            is_function_output: true,
          }),
          extra_params: [
            {
              key: 'index_type',
              value: IndexType.SPARSE_INVERTED_INDEX,
            },
            { key: 'metric_type', value: 'BM25' },
            {
              key: 'params',
              value: '{"inverted_index_algo":"DAAT_MAXSCORE","bm25_k1":1.2}',
            },
          ],
        })
      );
      expect(addRequest.func_schema).toEqual([
        expect.objectContaining({
          name: 'bm25_function',
          type: FunctionType.BM25,
          input_field_names: ['text'],
          output_field_names: ['sparse_vector'],
          params: [{ key: 'analyzer', value: 'standard' }],
        }),
      ]);
    });

    it('serializes a MinHash function field and its bound index parameters', async () => {
      const { client, rpcClient } = createTestClient();
      rpcClient.AlterCollectionSchema.mockImplementation(
        respondWith({ alter_status: successStatus })
      );

      await client.addFunctionField({
        collection_name: COLLECTION_NAME,
        field: {
          name: 'minhash_vector',
          data_type: DataType.BinaryVector,
          dim: 512,
          is_function_output: true,
        },
        function: {
          name: 'minhash_function',
          type: 'MinHash',
          input_field_names: ['text'],
          output_field_names: ['minhash_vector'],
          params: { num_hashes: 16 },
        },
        index_name: 'minhash_index',
        extra_params: {
          index_type: IndexType.MINHASH_LSH,
          metric_type: 'MHJACCARD',
          params: { mh_lsh_band: 4 },
        },
      });

      const addRequest =
        rpcClient.AlterCollectionSchema.mock.calls[0][0].action.add_request;
      expect(addRequest.field_infos[0]).toEqual(
        expect.objectContaining({
          index_name: 'minhash_index',
          field_schema: expect.objectContaining({
            name: 'minhash_vector',
            data_type: DataType.BinaryVector,
          }),
          extra_params: expect.arrayContaining([
            { key: 'index_type', value: IndexType.MINHASH_LSH },
            { key: 'metric_type', value: 'MHJACCARD' },
            { key: 'params', value: '{"mh_lsh_band":4}' },
          ]),
        })
      );
      expect(addRequest.func_schema[0]).toEqual(
        expect.objectContaining({
          name: 'minhash_function',
          type: FunctionType.MINHASH,
          params: [{ key: 'num_hashes', value: '16' }],
        })
      );
    });

    it.each([
      { index_type: IndexType.SPARSE_INVERTED_INDEX, metric_type: 'BM25' },
      JSON.stringify({
        index_type: IndexType.SPARSE_INVERTED_INDEX,
        metric_type: 'BM25',
      }),
    ])('accepts index_type from legacy nested params %#', async params => {
      const { client, rpcClient } = createTestClient();
      rpcClient.AlterCollectionSchema.mockImplementation(
        respondWith({ alter_status: successStatus })
      );

      await client.addFunctionField({
        collection_name: COLLECTION_NAME,
        field: {
          name: 'sparse_vector',
          data_type: DataType.SparseFloatVector,
        },
        function: bm25Function,
        extra_params: { params },
      });

      expect(
        rpcClient.AlterCollectionSchema.mock.calls[0][0].action.add_request
          .field_infos[0].extra_params
      ).toEqual([
        {
          key: 'params',
          value: typeof params === 'string' ? params : JSON.stringify(params),
        },
      ]);
    });

    it('treats an undefined top-level index_type as absent', async () => {
      const { client, rpcClient } = createTestClient();
      rpcClient.AlterCollectionSchema.mockImplementation(
        respondWith({ alter_status: successStatus })
      );

      await client.addFunctionField({
        collection_name: COLLECTION_NAME,
        field: {
          name: 'sparse_vector',
          data_type: DataType.SparseFloatVector,
        },
        function: bm25Function,
        extra_params: {
          index_type: undefined,
          params: {
            index_type: IndexType.SPARSE_INVERTED_INDEX,
            metric_type: 'BM25',
          },
        },
      });

      expect(
        rpcClient.AlterCollectionSchema.mock.calls[0][0].action.add_request
          .field_infos[0].extra_params
      ).toEqual([
        {
          key: 'params',
          value: JSON.stringify({
            index_type: IndexType.SPARSE_INVERTED_INDEX,
            metric_type: 'BM25',
          }),
        },
      ]);
    });

    it.each([
      { index_type: undefined },
      { index_type: '' },
      { params: { metric_type: 'BM25' } },
    ])('rejects missing index_type %#', async extraParams => {
      const { client, rpcClient } = createTestClient();

      await expect(
        client.addFunctionField({
          collection_name: COLLECTION_NAME,
          field: {
            name: 'sparse_vector',
            data_type: DataType.SparseFloatVector,
          },
          function: bm25Function,
          extra_params: extraParams,
        } as any)
      ).rejects.toThrow(
        ERROR_REASONS.ADD_FUNCTION_FIELD_INDEX_TYPE_IS_REQUIRED
      );

      expect(rpcClient.AlterCollectionSchema).not.toHaveBeenCalled();
    });

    it('rejects AUTOINDEX for a bound function-field index', async () => {
      const { client, rpcClient } = createTestClient();

      await expect(
        client.addFunctionField({
          collection_name: COLLECTION_NAME,
          field: {
            name: 'sparse_vector',
            data_type: DataType.SparseFloatVector,
          },
          function: bm25Function,
          extra_params: { index_type: IndexType.AUTOINDEX },
        })
      ).rejects.toThrow(
        ERROR_REASONS.ADD_FUNCTION_FIELD_AUTOINDEX_NOT_SUPPORTED
      );

      expect(rpcClient.AlterCollectionSchema).not.toHaveBeenCalled();
    });

    it.each([
      { index_type: IndexType.SPARSE_WAND },
      JSON.stringify({ metric_type: 'IP' }),
    ])('rejects duplicated nested bound-index params %#', async params => {
      const { client, rpcClient } = createTestClient();

      await expect(
        client.addFunctionField({
          collection_name: COLLECTION_NAME,
          field: {
            name: 'sparse_vector',
            data_type: DataType.SparseFloatVector,
          },
          function: bm25Function,
          extra_params: {
            index_type: IndexType.SPARSE_INVERTED_INDEX,
            metric_type: 'BM25',
            params,
          },
        })
      ).rejects.toThrow(
        ERROR_REASONS.ADD_FUNCTION_FIELD_DUPLICATED_INDEX_PARAM
      );

      expect(rpcClient.AlterCollectionSchema).not.toHaveBeenCalled();
    });

    it('drops a function field with its output fields and indexes', async () => {
      const { client, rpcClient } = createTestClient();
      rpcClient.AlterCollectionSchema.mockImplementation(
        respondWith({ alter_status: successStatus })
      );
      const cache = seedCollectionCache(client);

      const result = await client.dropFunctionField({
        collection_name: COLLECTION_NAME,
        function_name: 'bm25_function',
      });

      expect(result).toEqual(successStatus);
      expect(rpcClient.AlterCollectionSchema.mock.calls[0][0]).toEqual({
        collection_name: COLLECTION_NAME,
        action: {
          drop_request: {
            function_name: 'bm25_function',
            drop_function_output_fields: true,
          },
        },
      });
      expect(cache.has(cacheKey())).toBe(false);
    });
  });

  describe('legacy function APIs', () => {
    it('keeps addCollectionFunction on the legacy RPC', async () => {
      const { client, rpcClient } = createTestClient();
      rpcClient.AddCollectionFunction.mockImplementation(
        respondWith(successStatus)
      );

      const result = await client.addCollectionFunction({
        collection_name: COLLECTION_NAME,
        function: bm25Function,
      });

      expect(result).toEqual(successStatus);
      expect(rpcClient.AddCollectionFunction).toHaveBeenCalledTimes(1);
      expect(rpcClient.AlterCollectionSchema).not.toHaveBeenCalled();
      expect(rpcClient.AddCollectionFunction.mock.calls[0][0]).toEqual({
        collection_name: COLLECTION_NAME,
        functionSchema: expect.objectContaining({
          name: 'bm25_function',
          type: FunctionType.BM25,
        }),
      });
    });

    it('keeps dropCollectionFunction on the legacy RPC', async () => {
      const { client, rpcClient } = createTestClient();
      rpcClient.DropCollectionFunction.mockImplementation(
        respondWith(successStatus)
      );

      const result = await client.dropCollectionFunction({
        collection_name: COLLECTION_NAME,
        function_name: 'bm25_function',
      });

      expect(result).toEqual(successStatus);
      expect(rpcClient.DropCollectionFunction).toHaveBeenCalledTimes(1);
      expect(rpcClient.AlterCollectionSchema).not.toHaveBeenCalled();
      expect(rpcClient.DropCollectionFunction.mock.calls[0][0]).toEqual({
        collection_name: COLLECTION_NAME,
        function_name: 'bm25_function',
      });
    });
  });

  describe('collection cache', () => {
    it('evicts the requested database entry after dropping a collection', async () => {
      const { client, rpcClient } = createTestClient();
      rpcClient.DropCollection.mockImplementation(respondWith(successStatus));
      const cache = seedCollectionCache(client, 'db1');
      cache.set(cacheKey(), { activeDatabaseEntry: true });

      const result = await client.dropCollection({
        collection_name: COLLECTION_NAME,
        db_name: 'db1',
      });

      expect(result).toEqual(successStatus);
      expect(cache.has(cacheKey('db1'))).toBe(false);
      expect(cache.has(cacheKey())).toBe(true);
    });
  });
});
