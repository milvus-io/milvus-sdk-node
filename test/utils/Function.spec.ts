import {
  promisify,
  getQueryIteratorExpr,
  DataTypeStringEnum,
  MIN_INT64,
  getPKFieldExpr,
  getRangeFromSearchResult,
  SearchResultData,
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

    expect(result).toBe("id > '' && field > 10");
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

    expect(result).toBe('id > 10 && field > 10');
  });

  it('should return 0 radius when results are empty', () => {
    const results = [] as any;

    const result = getRangeFromSearchResult(results);

    expect(result).toEqual({
      radius: 0,
      lastDistance: 0,
    });
  });

  it('should return radius and lastDistance when results are not empty', () => {
    const results: SearchResultData[] = [
      {
        id: '1',
        score: 0.1,
      },
      {
        id: '2',
        score: 0.2,
      },
      {
        id: '3',
        score: 0.3,
      },
    ];

    const result = getRangeFromSearchResult(results);

    expect(result).toEqual({
      radius: 0.3 * 3 - 0.1,
      lastDistance: 0.3,
      id: '3',
    });
  });

  it('should return 0 radius when results contain only one item', () => {
    const results: SearchResultData[] = [
      {
        id: '1',
        score: 0.1,
      },
    ];

    const result = getRangeFromSearchResult(results);

    expect(result).toEqual({
      radius: 0.1 * 3 - 0.1,
      lastDistance: 0.1,
      id: '1',
    });
  });

  it('should return 0 radius when results contain only two items', () => {
    const results: SearchResultData[] = [
      {
        id: '1',
        score: 0.1,
      },
      {
        id: '2',
        score: 0.2,
      },
    ];

    const result = getRangeFromSearchResult(results);

    expect(result).toEqual({
      radius: 0.2 * 3 - 0.1,
      lastDistance: 0.2,
      id: '2',
    });
  });

  it('should return varchar expression when pk field is varchar', () => {
    const pkField: any = {
      name: 'id',
      data_type: DataTypeStringEnum.VarChar,
    };

    const result = getPKFieldExpr({
      pkField,
      value: 'abc',
    });

    expect(result).toBe("id != 'abc'");
  });

  it('should return int64 expression when pk field is int64', () => {
    const pkField: any = {
      name: 'id',
      data_type: DataTypeStringEnum.Int64,
    };

    const result = getPKFieldExpr({
      pkField,
      value: 10,
    });

    expect(result).toBe('id != 10');
  });

  it('should return int64 expression with condition when condition is provided', () => {
    const pkField: any = {
      name: 'id',
      data_type: DataTypeStringEnum.Int64,
    };

    const result = getPKFieldExpr({
      pkField,
      value: 10,
      condition: '>',
    });

    expect(result).toBe('id > 10');
  });

  it('should return int64 expression with condition and expr when expr is provided', () => {
    const pkField: any = {
      name: 'id',
      data_type: DataTypeStringEnum.Int64,
    };

    const result = getPKFieldExpr({
      pkField,
      value: 10,
      condition: '>',
      expr: 'field > 10',
    });

    expect(result).toBe('id > 10 && field > 10');
  });
});
