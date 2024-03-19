import { promisify, getSparseDim, SparseFloatVectors } from '../../milvus';

describe('promisify', () => {
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

  it('should return the correct dimension of the sparse vector', () => {
    const data = [
      { '0': 1, '1': 2, '2': 3 },
      { '0': 1, '1': 2, '2': 3, '3': 4 },
      { '0': 1, '1': 2 },
    ] as SparseFloatVectors[];
    const result = getSparseDim(data);
    expect(result).toBe(4);
  });

  it('should return 0 for an empty array', () => {
    const data = [] as SparseFloatVectors[];
    const result = getSparseDim(data);
    expect(result).toBe(0);
  });

  it('should return the correct dimension when the sparse vectors have different lengths', () => {
    const data = [
      { '0': 1, '1': 2, '2': 3, '3': 4, '4': 5 },
      { '0': 1, '1': 2 },
      { '0': 1, '1': 2, '2': 3, '3': 4 },
    ] as SparseFloatVectors[];
    const result = getSparseDim(data);
    expect(result).toBe(5);
  });
});
