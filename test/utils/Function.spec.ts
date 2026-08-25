import {
  promisify,
  getQueryIteratorExpr,
  DataTypeStringEnum,
  DEFAULT_MIN_INT64,
  getPKFieldExpr,
  SearchResultData,
  getSparseDim,
  SparseFloatVector,
  getDataKey,
  DataType,
  getValidDataArray,
  extractRequestMetadata,
  setPoolFailoverHandler,
  setPoolTelemetryManager,
  withTelemetryLogicalOperation,
  withTelemetrySuppressed,
  getGRPCService,
  LOADER_OPTIONS,
} from '../../milvus';
import {
  credentials,
  Metadata,
  Server,
  ServerCredentials,
} from '@grpc/grpc-js';

describe('Function API testing', () => {
  let pool: any;
  let client: any;

  beforeEach(() => {
    client = {
      testFunction: jest.fn((params, options, callback) =>
        callback(null, 'success')
      ),
    };
    pool = {
      acquire: jest.fn().mockResolvedValue(client),
      release: jest.fn(),
    };
  });

  it('should resolve with the result of the function call', async () => {
    const result = await promisify(pool, 'testFunction', {}, 1000);
    expect(result).toBe('success');
    expect(client.testFunction).toHaveBeenCalled();
    expect(pool.acquire).toHaveBeenCalled();
    expect(pool.release).toHaveBeenCalled();
  });

  it('should reject if the function call results in an error', async () => {
    client.testFunction = jest.fn((params, options, callback) =>
      callback('error')
    );
    await expect(promisify(pool, 'testFunction', {}, 1000)).rejects.toBe(
      'error'
    );
    expect(client.testFunction).toHaveBeenCalled();
    expect(pool.acquire).toHaveBeenCalled();
    expect(pool.release).toHaveBeenCalled();
  });

  it('should reject if the function call throws an exception', async () => {
    client.testFunction = jest.fn(() => {
      throw new Error('exception');
    });
    await expect(promisify(pool, 'testFunction', {}, 1000)).rejects.toThrow(
      'exception'
    );
    expect(pool.acquire).toHaveBeenCalled();
    expect(pool.release).toHaveBeenCalled();
  });

  it('should return varchar expression when cache does not exist', () => {
    const params = {
      expr: '',
      pkField: {
        name: 'id',
        data_type: DataTypeStringEnum.VarChar,
      },
      lastPKId: undefined,
    } as any;

    const result = getQueryIteratorExpr(params);

    expect(result).toBe("id > ''");
  });

  it('should return varchar expression when cache exists', () => {
    const params = {
      expr: '',
      pkField: {
        name: 'id',
        data_type: DataTypeStringEnum.VarChar,
      },
      lastPKId: 'abc',
    } as any;

    const result = getQueryIteratorExpr(params);

    expect(result).toBe("id > 'abc'");
  });

  it('should return varchar expression combined with iteratorExpr when expr is provided', () => {
    const params = {
      expr: 'field > 10',
      pkField: {
        name: 'id',
        data_type: DataTypeStringEnum.VarChar,
      },
      lastPKId: undefined,
    } as any;

    const result = getQueryIteratorExpr(params);

    expect(result).toBe("id > '' && (field > 10)");
  });

  it('should return int64 expression when cache does not exist', () => {
    const params = {
      expr: '',
      pkField: {
        name: 'id',
        data_type: DataTypeStringEnum.Int64,
      },
      lastPKId: undefined,
    } as any;

    const result = getQueryIteratorExpr(params);

    expect(result).toBe(`id > ${DEFAULT_MIN_INT64}`);
  });

  it('should return int64 expression when cache exists', () => {
    const params = {
      expr: '',
      pkField: {
        name: 'id',
        data_type: DataTypeStringEnum.Int64,
      },
      lastPKId: 10,
    } as any;

    const result = getQueryIteratorExpr(params);

    expect(result).toBe('id > 10');
  });

  it('should return int64 expression combined with iteratorExpr when expr is provided and cache exists', () => {
    const params = {
      expr: 'field > 10',
      pkField: {
        name: 'id',
        data_type: DataTypeStringEnum.Int64,
      },
      lastPKId: 10,
    } as any;

    const result = getQueryIteratorExpr(params);

    expect(result).toBe('id > 10 && (field > 10)');
  });

  it('keeps element_filter right-most and resumes the last element offset', () => {
    const result = getQueryIteratorExpr({
      expr: 'element_filter(items, $[score] >= 10)',
      pkField: {
        name: 'id',
        data_type: DataTypeStringEnum.Int64,
      } as any,
      lastPKId: 7,
      lastElementOffset: 1,
    });

    expect(result).toBe('id >= 7 && (element_filter(items, $[score] >= 10))');
  });

  it('preserves an Int64 primary key cursor with value zero', () => {
    const result = getQueryIteratorExpr({
      expr: 'element_filter(items, $[score] >= 10)',
      pkField: {
        name: 'id',
        data_type: DataTypeStringEnum.Int64,
      } as any,
      lastPKId: 0,
      lastElementOffset: 1,
    });

    expect(result).toBe('id >= 0 && (element_filter(items, $[score] >= 10))');
  });

  it('should return the correct dimension of the sparse vector', () => {
    const data = [
      { '0': 1, '1': 2, '2': 3 },
      { '0': 1, '1': 2, '2': 3, '3': 4 },
      { '0': 1, '1': 2 },
    ] as SparseFloatVector[];
    const result = getSparseDim(data);
    expect(result).toBe(4);
  });

  it('should return 0 for an empty array', () => {
    const data = [] as SparseFloatVector[];
    const result = getSparseDim(data);
    expect(result).toBe(0);
  });

  it('should return the correct dimension when the sparse vectors have different lengths', () => {
    const data = [
      { '0': 1, '1': 2, '2': 3, '3': 4, '4': 5 },
      { '0': 1, '1': 2 },
      { '0': 1, '1': 2, '2': 3, '3': 4 },
    ] as SparseFloatVector[];
    const result = getSparseDim(data);
    expect(result).toBe(5);
  });

  it('should return the correct data key for each data type without camel case conversion', () => {
    expect(getDataKey(DataType.FloatVector)).toEqual('float_vector');
    expect(getDataKey(DataType.Float16Vector)).toEqual('float16_vector');
    expect(getDataKey(DataType.BFloat16Vector)).toEqual('bfloat16_vector');
    expect(getDataKey(DataType.BinaryVector)).toEqual('binary_vector');
    expect(getDataKey(DataType.SparseFloatVector)).toEqual(
      'sparse_float_vector'
    );
    expect(getDataKey(DataType.Double)).toEqual('double_data');
    expect(getDataKey(DataType.Float)).toEqual('float_data');
    expect(getDataKey(DataType.Int64)).toEqual('long_data');
    expect(getDataKey(DataType.Int32)).toEqual('int_data');
    expect(getDataKey(DataType.Int16)).toEqual('int_data');
    expect(getDataKey(DataType.Int8)).toEqual('int_data');
    expect(getDataKey(DataType.Bool)).toEqual('bool_data');
    expect(getDataKey(DataType.VarChar)).toEqual('string_data');
    expect(getDataKey(DataType.Text)).toEqual('string_data');
    expect(getDataKey(DataType.Array)).toEqual('array_data');
    expect(getDataKey(DataType.JSON)).toEqual('json_data');
    expect(getDataKey(DataType.None)).toEqual('none');
  });

  it('should return the correct data key for each data type with camel case conversion', () => {
    expect(getDataKey(DataType.FloatVector, true)).toEqual('floatVector');
    expect(getDataKey(DataType.Float16Vector, true)).toEqual('float16Vector');
    expect(getDataKey(DataType.BFloat16Vector, true)).toEqual('bfloat16Vector');
    expect(getDataKey(DataType.BinaryVector, true)).toEqual('binaryVector');
    expect(getDataKey(DataType.SparseFloatVector, true)).toEqual(
      'sparseFloatVector'
    );
    expect(getDataKey(DataType.Double, true)).toEqual('doubleData');
    expect(getDataKey(DataType.Float, true)).toEqual('floatData');
    expect(getDataKey(DataType.Int64, true)).toEqual('longData');
    expect(getDataKey(DataType.Int32, true)).toEqual('intData');
    expect(getDataKey(DataType.Int16, true)).toEqual('intData');
    expect(getDataKey(DataType.Int8, true)).toEqual('intData');
    expect(getDataKey(DataType.Bool, true)).toEqual('boolData');
    expect(getDataKey(DataType.VarChar, true)).toEqual('stringData');
    expect(getDataKey(DataType.Text, true)).toEqual('stringData');
    expect(getDataKey(DataType.Array, true)).toEqual('arrayData');
    expect(getDataKey(DataType.JSON, true)).toEqual('jsonData');
    expect(getDataKey(DataType.None, true)).toEqual('none');
  });

  it('should return the valid array', () => {
    const a = [1, 2, 3];
    const length = 5;
    const result = getValidDataArray(a, length);
    expect(result).toEqual([true, true, true, false, false]);

    const b = [1, null, 3];
    const result2 = getValidDataArray(b, length);
    expect(result2).toEqual([true, false, true, false, false]);

    const c: any = [];
    const result3 = getValidDataArray(c, length);
    expect(result3).toEqual([false, false, false, false, false]);

    const d: any = [1, 2, 3, 4, undefined];
    const result4 = getValidDataArray(d, length);
    expect(result4).toEqual([true, true, true, true, false]);

    const e = [
      [1, 2],
      [3, 4],
      [5, 6],
    ];
    const result5 = getValidDataArray(e, length);
    expect(result5).toEqual([true, true, true, false, false]);
  });

  describe('promisify with traceid', () => {
    it('should extract client_request_id from params automatically', async () => {
      const traceId = '11111111111111111111111111111111';
      const params = {
        collection_name: 'test_collection',
        client_request_id: traceId,
      };

      let capturedMetadata: Metadata | undefined;
      client.testFunction = jest.fn((params, metadata, options, callback) => {
        capturedMetadata = metadata;
        callback(null, 'success');
      });

      await promisify(pool, 'testFunction', params, 1000);

      expect(capturedMetadata).toBeDefined();
      expect(capturedMetadata?.get('client-request-id')).toEqual([traceId]);
    });

    it('should extract client-request-id from params automatically', async () => {
      const traceId = '22222222222222222222222222222222';
      const params = {
        collection_name: 'test_collection',
        'client-request-id': traceId,
      };

      let capturedMetadata: Metadata | undefined;
      client.testFunction = jest.fn((params, metadata, options, callback) => {
        capturedMetadata = metadata;
        callback(null, 'success');
      });

      await promisify(pool, 'testFunction', params, 1000);

      expect(capturedMetadata).toBeDefined();
      expect(capturedMetadata?.get('client-request-id')).toEqual([traceId]);
    });

    it('should prefer client_request_id over client-request-id when both exist', async () => {
      const params = {
        collection_name: 'test_collection',
        client_request_id: '33333333333333333333333333333333',
        'client-request-id': '44444444444444444444444444444444',
      };

      let capturedMetadata: Metadata | undefined;
      client.testFunction = jest.fn((params, metadata, options, callback) => {
        capturedMetadata = metadata;
        callback(null, 'success');
      });

      await promisify(pool, 'testFunction', params, 1000);

      expect(capturedMetadata).toBeDefined();
      expect(capturedMetadata?.get('client-request-id')).toEqual([
        '33333333333333333333333333333333',
      ]);
    });

    it('should use explicit requestMetadata when provided', async () => {
      const params = {
        collection_name: 'test_collection',
        client_request_id: '55555555555555555555555555555555',
      };
      const explicitMetadata = {
        'client-request-id': '66666666666666666666666666666666',
      };

      let capturedMetadata: Metadata | undefined;
      client.testFunction = jest.fn((params, metadata, options, callback) => {
        capturedMetadata = metadata;
        callback(null, 'success');
      });

      await promisify(pool, 'testFunction', params, 1000, explicitMetadata);

      expect(capturedMetadata).toBeDefined();
      expect(capturedMetadata?.get('client-request-id')).toEqual([
        '66666666666666666666666666666666',
      ]);
    });

    it('should not add metadata when no traceid is provided', async () => {
      const params = {
        collection_name: 'test_collection',
      };

      let capturedMetadata: Metadata | undefined;
      client.testFunction = jest.fn((params, options, callback) => {
        capturedMetadata = options.metadata;
        callback(null, 'success');
      });

      await promisify(pool, 'testFunction', params, 1000);

      expect(capturedMetadata).toBeUndefined();
    });

    it('preserves documented legacy request IDs on the wire', async () => {
      for (const clientRequestId of [
        'not-a-trace-id',
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        '00000000000000000000000000000000',
      ]) {
        let capturedMetadata: Metadata | undefined;
        client.testFunction = jest.fn((params, metadata, options, callback) => {
          capturedMetadata = metadata;
          callback(null, 'success');
        });

        await promisify(
          pool,
          'testFunction',
          { client_request_id: clientRequestId },
          1000
        );

        expect(capturedMetadata?.get('client-request-id')).toEqual([
          clientRequestId,
        ]);
      }
    });

    it('sends a legacy request ID through a real grpc-js channel', async () => {
      const Service = getGRPCService(
        { serviceName: 'milvus.proto.milvus.MilvusService' },
        LOADER_OPTIONS
      );
      const server = new Server();
      let wireRequestId: string[] = [];
      server.addService((Service as any).service, {
        GetVersion: (call: any, callback: Function) => {
          wireRequestId = call.metadata.get('client-request-id');
          callback(null, {
            status: { error_code: 'Success', reason: '' },
            version: 'test',
          });
        },
      });
      const port = await new Promise<number>((resolve, reject) => {
        server.bindAsync(
          '127.0.0.1:0',
          ServerCredentials.createInsecure(),
          (error, boundPort) => (error ? reject(error) : resolve(boundPort))
        );
      });
      const grpcClient = new Service(
        `127.0.0.1:${port}`,
        credentials.createInsecure()
      );
      const grpcPool: any = {
        acquire: jest.fn().mockResolvedValue(grpcClient),
        release: jest.fn(),
      };

      try {
        await promisify(
          grpcPool,
          'GetVersion',
          { client_request_id: 'legacy-wire-id' },
          1000
        );
        expect(wireRequestId).toEqual(['legacy-wire-id']);
      } finally {
        grpcClient.close();
        await new Promise<void>(resolve => server.tryShutdown(() => resolve()));
      }
    });
  });

  describe('extractRequestMetadata', () => {
    it('should extract client_request_id from data', () => {
      const data = {
        collection_name: 'test',
        client_request_id: '77777777777777777777777777777777',
      };
      const result = extractRequestMetadata(data);
      expect(result).toEqual({
        'client-request-id': '77777777777777777777777777777777',
      });
    });

    it('should preserve a documented arbitrary string request ID', () => {
      expect(
        extractRequestMetadata({
          client_request_id: 'insert-trace-123',
        })
      ).toEqual({ 'client-request-id': 'insert-trace-123' });
    });

    it('should extract client-request-id from data', () => {
      const data = {
        collection_name: 'test',
        'client-request-id': '88888888888888888888888888888888',
      };
      const result = extractRequestMetadata(data);
      expect(result).toEqual({
        'client-request-id': '88888888888888888888888888888888',
      });
    });

    it('should prefer client_request_id over client-request-id', () => {
      const data = {
        collection_name: 'test',
        client_request_id: '99999999999999999999999999999999',
        'client-request-id': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      };
      const result = extractRequestMetadata(data);
      expect(result).toEqual({
        'client-request-id': '99999999999999999999999999999999',
      });
    });

    it('should return undefined when no traceid is provided', () => {
      const data = {
        collection_name: 'test',
      };
      const result = extractRequestMetadata(data);
      expect(result).toBeUndefined();
    });

    it('should handle null and undefined values', () => {
      expect(extractRequestMetadata(null)).toBeUndefined();
      expect(extractRequestMetadata(undefined)).toBeUndefined();
      expect(extractRequestMetadata({})).toBeUndefined();
    });

    it('should reject non-string trace IDs', () => {
      const data = {
        collection_name: 'test',
        client_request_id: 12345,
      };
      const result = extractRequestMetadata(data);
      expect(result).toBeUndefined();
    });
  });

  it('records one telemetry outcome across global failover', async () => {
    const unavailable = Object.assign(new Error('unavailable'), {
      code: 14,
    });
    client.Search = jest.fn((params, options, callback) =>
      callback(unavailable)
    );
    const failoverClient = {
      Search: jest.fn((params, options, callback) =>
        callback(null, { status: { error_code: 'Success' } })
      ),
    };
    const failoverPool: any = {
      acquire: jest.fn().mockResolvedValue(failoverClient),
      release: jest.fn(),
    };
    const telemetry = { recordOperation: jest.fn() };
    setPoolTelemetryManager(pool, telemetry);
    setPoolTelemetryManager(failoverPool, telemetry);
    setPoolFailoverHandler(pool, async () => failoverPool);

    await promisify(pool, 'Search', { collection_name: 'books' }, 1000);

    expect(client.Search).toHaveBeenCalledTimes(1);
    expect(failoverClient.Search).toHaveBeenCalledTimes(1);
    expect(telemetry.recordOperation).toHaveBeenCalledTimes(1);
    expect(telemetry.recordOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'Search',
        collection: 'books',
        error: undefined,
      })
    );
  });

  it('keeps a legacy wire ID out of OTel telemetry correlation', async () => {
    let capturedMetadata: Metadata | undefined;
    client.Search = jest.fn((params, metadata, options, callback) => {
      capturedMetadata = metadata;
      callback(null, { status: { error_code: 'Success' } });
    });
    const telemetry = { recordOperation: jest.fn() };
    setPoolTelemetryManager(pool, telemetry);

    await promisify(
      pool,
      'Search',
      {
        collection_name: 'books',
        client_request_id: 'insert-trace-123',
      },
      1000
    );

    expect(capturedMetadata?.get('client-request-id')).toEqual([
      'insert-trace-123',
    ]);
    expect(telemetry.recordOperation).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: undefined })
    );
  });

  it('records RunAnalyzer globally even when the request carries a collection', async () => {
    client.RunAnalyzer = jest.fn((params, options, callback) =>
      callback(null, { status: { error_code: 'Success' } })
    );
    const telemetry = { recordOperation: jest.fn() };
    setPoolTelemetryManager(pool, telemetry);

    await promisify(pool, 'RunAnalyzer', { collection_name: 'books' }, 1000);

    expect(telemetry.recordOperation).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'RunAnalyzer', collection: '' })
    );
  });

  it('does not let a telemetry recorder failure change the logical result', async () => {
    const hostileFailure = {
      toString: () => {
        throw new Error('coercion must never run');
      },
    };
    const telemetry = {
      recordOperation: jest.fn(() => {
        throw hostileFailure;
      }),
    };
    setPoolTelemetryManager(pool, telemetry);

    await expect(
      withTelemetryLogicalOperation(
        pool,
        'Search',
        { collection_name: 'books' },
        async () => 'business-result'
      )
    ).resolves.toBe('business-result');
    expect(telemetry.recordOperation).toHaveBeenCalledTimes(1);
  });

  it('records a monitored RPC once at the enclosing public logical boundary', async () => {
    client.Search = jest.fn((params, options, callback) =>
      callback(null, { status: { error_code: 'Success' } })
    );
    const telemetry = { recordOperation: jest.fn() };
    setPoolTelemetryManager(pool, telemetry);

    await withTelemetryLogicalOperation(
      pool,
      'Search',
      { collection_name: 'books' },
      () => promisify(pool, 'Search', { collection_name: 'books' }, 1000)
    );

    expect(client.Search).toHaveBeenCalledTimes(1);
    expect(telemetry.recordOperation).toHaveBeenCalledTimes(1);
    expect(telemetry.recordOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'Search',
        collection: 'books',
        error: undefined,
      })
    );
  });

  it('coalesces nested helpers for the same logical operation', async () => {
    client.Delete = jest.fn((params, options, callback) =>
      callback(null, { status: { error_code: 'Success' } })
    );
    const telemetry = { recordOperation: jest.fn() };
    setPoolTelemetryManager(pool, telemetry);

    await withTelemetryLogicalOperation(
      pool,
      'Delete',
      { collection_name: 'books' },
      () =>
        withTelemetryLogicalOperation(
          pool,
          'Delete',
          { collection_name: 'books' },
          () => promisify(pool, 'Delete', { collection_name: 'books' }, 1000)
        )
    );

    expect(telemetry.recordOperation).toHaveBeenCalledTimes(1);
  });

  it('isolates concurrent logical operations', async () => {
    client.Search = jest.fn((params, options, callback) =>
      setTimeout(() => callback(null, { status: { error_code: 'Success' } }), 5)
    );
    client.Query = jest.fn((params, options, callback) =>
      setTimeout(() => callback(null, { status: { error_code: 'Success' } }), 1)
    );
    const telemetry = { recordOperation: jest.fn() };
    setPoolTelemetryManager(pool, telemetry);

    await Promise.all([
      withTelemetryLogicalOperation(
        pool,
        'Search',
        { collection_name: 'books' },
        () => promisify(pool, 'Search', { collection_name: 'books' }, 1000)
      ),
      withTelemetryLogicalOperation(
        pool,
        'Query',
        { collection_name: 'authors' },
        () => promisify(pool, 'Query', { collection_name: 'authors' }, 1000)
      ),
    ]);

    expect(telemetry.recordOperation).toHaveBeenCalledTimes(2);
    expect(telemetry.recordOperation).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'Search', collection: 'books' })
    );
    expect(telemetry.recordOperation).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'Query', collection: 'authors' })
    );
  });

  it('suppresses logical-operation and RPC-level telemetry inside iterators', async () => {
    client.Search = jest.fn((params, options, callback) =>
      callback(null, { status: { error_code: 'Success' } })
    );
    const telemetry = { recordOperation: jest.fn() };
    setPoolTelemetryManager(pool, telemetry);

    await withTelemetrySuppressed(() =>
      withTelemetryLogicalOperation(
        pool,
        'Search',
        { collection_name: 'books' },
        () => promisify(pool, 'Search', { collection_name: 'books' }, 1000)
      )
    );

    expect(client.Search).toHaveBeenCalledTimes(1);
    expect(telemetry.recordOperation).not.toHaveBeenCalled();
  });

  it('suppresses the promisify RPC-level fallback for internal page fetches', async () => {
    client.Query = jest.fn((params, options, callback) =>
      callback(null, { status: { error_code: 'Success' } })
    );
    const telemetry = { recordOperation: jest.fn() };
    setPoolTelemetryManager(pool, telemetry);

    await withTelemetrySuppressed(() =>
      promisify(pool, 'Query', { collection_name: 'books' }, 1000)
    );

    expect(client.Query).toHaveBeenCalledTimes(1);
    expect(telemetry.recordOperation).not.toHaveBeenCalled();
  });

  it('resumes recording after the suppressed section exits', async () => {
    client.Search = jest.fn((params, options, callback) =>
      callback(null, { status: { error_code: 'Success' } })
    );
    const telemetry = { recordOperation: jest.fn() };
    setPoolTelemetryManager(pool, telemetry);

    await withTelemetrySuppressed(() =>
      withTelemetrySuppressed(() =>
        promisify(pool, 'Search', { collection_name: 'books' }, 1000)
      )
    );
    expect(telemetry.recordOperation).not.toHaveBeenCalled();

    await promisify(pool, 'Search', { collection_name: 'books' }, 1000);
    expect(telemetry.recordOperation).toHaveBeenCalledTimes(1);
    expect(telemetry.recordOperation).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'Search', collection: 'books' })
    );
  });
});
