import {
  promisify,
  getQueryIteratorExpr,
  DataTypeStringEnum,
  MIN_INT64,
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
      page: 1,
      pageCache: new Map(),
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
      page: 2,
      pageCache: new Map([
        [
          1,
          {
            lastPKId: 'abc',
          },
        ],
      ]),
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
      pageCache: new Map(),
    } as any;

    const result = getQueryIteratorExpr(params);

    expect(result).toBe("(id > '') && field > 10");
  });

  it('should return int64 expression when cache does not exist', () => {
    const params = {
      expr: '',
      pkField: {
        name: 'id',
        data_type: DataTypeStringEnum.Int64,
      },
      page: 1,
      pageCache: new Map(),
    } as any;

    const result = getQueryIteratorExpr(params);

    expect(result).toBe(`id > ${MIN_INT64}`);
  });

  it('should return int64 expression when cache exists', () => {
    const params = {
      expr: '',
      pkField: {
        name: 'id',
        data_type: DataTypeStringEnum.Int64,
      },
      page: 2,
      pageCache: new Map([
        [
          1,
          {
            lastPKId: 10,
          },
        ],
      ]),
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
      page: 2,
      pageCache: new Map([
        [
          1,
          {
            lastPKId: 10,
          },
        ],
      ]),
    } as any;

    const result = getQueryIteratorExpr(params);

    expect(result).toBe('(id > 10) && field > 10');
  });
});
