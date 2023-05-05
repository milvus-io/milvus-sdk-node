import { promisify } from '../../milvus';

describe(`utils/function`, () => {
  it('should resolve with the result of the target function call', async () => {
    const obj = {
      target: (params: any, options: any, callback: any) => {
        callback(null, 'result');
      },
    };
    const target = 'target';
    const params = {};
    const timeout = 1000;
    const result = await promisify(obj, target, params, timeout);
    expect(result).toEqual('result');
  });

  it('should reject with the error if there was an error', async () => {
    const obj = {
      target: (params: any, options: any, callback: any) => {
        callback(new Error('error'));
      },
    };
    const target = 'target';
    const params = {};
    const timeout = 1000;
    await expect(promisify(obj, target, params, timeout)).rejects.toThrow(
      'error'
    );
  });

  it('should reject with the error if there was an exception', async () => {
    const obj = {
      target: () => {
        throw new Error('exception');
      },
    };
    const target = 'target';
    const params = {};
    const timeout = 1000;
    await expect(promisify(obj, target, params, timeout)).rejects.toThrow(
      'exception'
    );
  });

  it('should use the default timeout if no timeout is provided', async () => {
    const obj = {
      target: (params: any, options: any, callback: any) => {
        callback(null, 'result');
      },
    };
    const target = 'target';
    const params = {};
    const result = await promisify(obj, target, params, 0);
    expect(result).toEqual('result');
  });
});
