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
} from '../../milvus';

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
      lastPkId: '',
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
      page: 1,
      lastPkId: '',
    } as any;

    const result = getQueryIteratorExpr(params);

    expect(result).toBe("id > '' && field > 10");
  });

  it('should return int64 expression when cache does not exist', () => {
    const params = {
      expr: '',
      pkField: {
        name: 'id',
        data_type: DataTypeStringEnum.Int64,
      },
      lastPkId: '',
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

    expect(result).toBe('id > 10 && field > 10');
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
});
