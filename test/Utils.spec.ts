import { promisify } from '../utils/index';
import path from 'path';
import {
  datetimeToHybrids,
  hybridtsToUnixtime,
  unixtimeToHybridts,
  formatAddress,
  stringToBase64,
  parseToKeyValue,
  formatKeyValueData,
  formatNumberPrecision,
  getGRPCService,
  getAuthInterceptor,
  checkTimeParam,
  assignTypeParams,
} from '../utils';
import { ERROR_REASONS } from '../milvus';
import { generateInsertData } from '../utils/test';
import { InterceptingCall } from '@grpc/grpc-js';
// mock
jest.mock('@grpc/grpc-js', () => {
  const actual = jest.requireActual(`@grpc/grpc-js`);

  return {
    InterceptingCall: jest.fn(),
    loadPackageDefinition: actual.loadPackageDefinition,
    ServiceClientConstructor: actual.ServiceClientConstructor,
    GrpcObject: actual.GrpcObject,
  };
});

describe(`Utils`, () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it(`should return true for a bigint input`, () => {
    expect(checkTimeParam(BigInt(123))).toBe(true);
  });

  it(`should return true for a string input that can be converted to a number`, () => {
    expect(checkTimeParam(`123`)).toBe(true);
  });

  it(`should return false for a string input that cannot be converted to a number`, () => {
    expect(checkTimeParam(`abc`)).toBe(false);
  });

  it(`should return false for other types of input`, () => {
    expect(checkTimeParam(null)).toBe(false);
    expect(checkTimeParam(undefined)).toBe(false);
    expect(checkTimeParam({})).toBe(false);
    expect(checkTimeParam([])).toBe(false);
    expect(checkTimeParam(() => {})).toBe(false);
  });
  it(`Promisify should catch  obj[target] is not a function`, async () => {
    let a = {};
    try {
      await promisify(a, 'a', {});
      expect('a').toEqual('b');
    } catch (error) {
      expect(error.message).toContain('obj[target] is not a function');
    }
  });

  it(`Promisify should catch error`, async () => {
    let a = {
      a: () => {
        throw new Error('123');
      },
    };
    try {
      await promisify(a, 'a', {});
      expect('a').toEqual('b');
    } catch (error) {
      expect(error.message).toContain('123');
    }
  });

  it(`Promisify should reject`, async () => {
    let a = {
      a: (params = {}, {}, callback = (err: any) => {}) => {
        callback('123');
      },
    };
    try {
      await promisify(a, 'a', {});
      expect('a').toEqual('b');
    } catch (error) {
      expect(error.message).toContain('123');
    }
  });

  it(`hybridtsToUnixtime should success`, async () => {
    let unixtime = hybridtsToUnixtime('429642767925248000');
    expect(unixtime).toEqual('1638957092');
  });

  it(`hybridtsToUnixtime should throw error`, async () => {
    try {
      hybridtsToUnixtime(1 as any);
    } catch (error) {
      expect(error.message).toContain(ERROR_REASONS.TIMESTAMP_PARAM_CHECK);
    }
  });

  it(`unixtimeToHybridts should success`, async () => {
    let unixtime = unixtimeToHybridts('1638957092');
    expect(unixtime).toEqual('429642767925248000');
  });

  it(`unixtimeToHybridts should throw error`, async () => {
    try {
      unixtimeToHybridts(1 as any);
    } catch (error) {
      expect(error.message).toContain(ERROR_REASONS.TIMESTAMP_PARAM_CHECK);
    }

    try {
      unixtimeToHybridts('asd');
    } catch (error) {
      expect(error.message).toContain(ERROR_REASONS.TIMESTAMP_PARAM_CHECK);
    }
  });

  it(`datetimeToHybrids should success`, async () => {
    let unixtime = datetimeToHybrids(new Date(1638957092 * 1000));
    expect(unixtime).toEqual('429642767925248000');
  });

  it(`datetimeToHybrids should throw error`, async () => {
    try {
      datetimeToHybrids(1 as any);
    } catch (error) {
      expect(error.message).toContain(ERROR_REASONS.DATE_TYPE_CHECK);
    }
  });

  it(`all kinds of url should be supported`, async () => {
    const port = `80980`;
    const urlWithHttps = `https://my-url:${port}`;
    expect(formatAddress(urlWithHttps)).toBe(`my-url:${port}`);

    const urlWithHttp = `https://my-url:${port}`;
    expect(formatAddress(urlWithHttp)).toBe(`my-url:${port}`);

    const urlWithoutHttp = `my-url`;
    expect(formatAddress(urlWithoutHttp)).toBe(`my-url:19530`);

    const urlWithoutHttpCustomPort = `my-url:12345`;
    expect(formatAddress(urlWithoutHttpCustomPort)).toBe(`my-url:12345`);

    const urlWithEmpty = `://my-url`;
    expect(formatAddress(urlWithEmpty)).toBe(`my-url:19530`);

    const urlWithEmptyCustomPort = `://my-url:12345`;
    expect(formatAddress(urlWithEmptyCustomPort)).toBe(`my-url:12345`);
  });

  it(`should convert string to base64 encoding`, () => {
    const testString = 'hello world, I love milvus';
    const str = stringToBase64(testString);
    expect(str.length % 4 == 0 && /^[A-Za-z0-9+/]+[=]{0,2}$/.test(str)).toBe(
      true
    );
  });

  it(`should convert [{key:"row_count",value:4}] to {row_count:4}`, () => {
    const testValue = [{ key: 'row_count', value: 4 }];
    const res = formatKeyValueData(testValue, ['row_count']);
    expect(res).toMatchObject({ row_count: 4 });
  });

  it(`should convert  {row_count:4} t0 [{key:"row_count",value:4}]`, () => {
    const testValue = { row_count: 4, b: 3 };
    const res = parseToKeyValue(testValue);
    expect(res).toMatchObject([
      { key: 'row_count', value: 4 },
      { key: 'b', value: 3 },
    ]);
  });

  it(`should convert [{key:"row_count",value:4}] to {row_count:4}`, () => {
    const testValue = 3.1231241241234124124;
    const res = formatNumberPrecision(testValue, 3);
    expect(res).toBe(3.123);
  });

  it(`should return a service client constructor`, () => {
    const protoPath = path.resolve(__dirname, '../proto/proto/milvus.proto');
    const proto = {
      protoPath,
      serviceName: `milvus.proto.milvus.MilvusService`,
    };
    const service = getGRPCService(proto);
    expect(service).toBeDefined();
  });

  it(`should throw an error if the service object is invalid`, () => {
    const protoPath = path.resolve(__dirname, '../proto/proto/milvus.proto');
    const proto = {
      protoPath,
      serviceName: `milvus.proto.milvus.MilvusService2`,
    };
    expect(() => getGRPCService(proto)).toThrowError();
  });

  it('should add an authorization header to the metadata of a gRPC call', () => {
    const username = 'testuser';
    const password = 'testpassword';
    const metadata = {
      add: jest.fn(),
    };
    const listener = jest.fn();
    const next = jest.fn();
    const nextCall = jest.fn(() => ({
      start: (metadata: any, listener: any, next: any) => {
        next(metadata, listener);
      },
    }));
    (InterceptingCall as any).mockImplementationOnce(
      (call: any, options: any) => {
        return {
          call,
          options,
          start: options.start,
        };
      }
    );

    const interceptor = getAuthInterceptor(username, password);
    const interceptedCall = interceptor({}, nextCall);

    (interceptedCall.start as any)(metadata, listener, next);

    expect(metadata.add).toHaveBeenCalledWith(
      'authorization',
      'dGVzdHVzZXI6dGVzdHBhc3N3b3Jk'
    );
  });
  it('should assign properties with keys `dim` or `max_length` to the `type_params` object and delete them from the `field` object', () => {
    const field = {
      name: 'vector',
      type: 'BinaryVector',
      dim: 128,
      max_length: 100,
    };
    const expectedOutput = {
      name: 'vector',
      type: 'BinaryVector',
      type_params: {
        dim: '128',
        max_length: '100',
      },
    };
    expect(assignTypeParams(field)).toEqual(expectedOutput);
  });

  it('should not modify the `field` object if it does not have properties with keys `dim` or `max_length`', () => {
    const field = {
      name: 'id',
      type: 'Int64',
    };
    const expectedOutput = {
      name: 'id',
      type: 'Int64',
    };
    expect(assignTypeParams(field)).toEqual(expectedOutput);
  });

  it('should convert properties with keys `dim` or `max_length` to strings if they already exist in the `type_params` object', () => {
    const field = {
      name: 'text',
      type: 'String',
      type_params: {
        dim: 100,
        max_length: 50,
      },
      dim: 200,
      max_length: 75,
    };
    const expectedOutput = {
      name: 'text',
      type: 'String',
      type_params: {
        dim: '200',
        max_length: '75',
      },
    };
    expect(assignTypeParams(field)).toEqual(expectedOutput);
  });

  it('should generate the correct number of data points', () => {
    const fields = [
      { name: 'field1', isVector: false },
      { name: 'field2', isVector: true, dim: 10 },
      { name: 'field3', isVector: false },
    ];
    const count = 100;
    const data = generateInsertData(fields, count);
    expect(data.length).toBe(count);
  });

  it('should generate data with the correct fields', () => {
    const fields = [
      { name: 'field1', isVector: false },
      { name: 'field2', isVector: true, dim: 10 },
      { name: 'field3', isVector: false },
    ];
    const count = 1;
    const data = generateInsertData(fields, count);
    expect(data[0]).toHaveProperty('field1');
    expect(data[0]).toHaveProperty('field2');
    expect(data[0]).toHaveProperty('field3');
  });

  it('should generate vector data with the correct length', () => {
    const fields = [
      { name: 'field1', isVector: false },
      { name: 'field2', isVector: true, dim: 10 },
      { name: 'field3', isVector: false },
    ];
    const count = 1;
    const data = generateInsertData(fields, count);
    expect(data[0].field2.length).toBe(10);
  });

  it('should generate boolean data with the correct values', () => {
    const fields = [
      { name: 'field1', isVector: false },
      { name: 'field2', isVector: false, isBool: true },
      { name: 'field3', isVector: false },
    ];
    const count = 2;
    const data = generateInsertData(fields, count);
    expect(data[0].field2).toBe(true);
    expect(data[1].field2).toBe(false);
  });

  it('should generate varchar data with the correct length', () => {
    const fields = [
      { name: 'field1', isVector: false },
      { name: 'field2', isVector: false, isVarChar: true },
      { name: 'field3', isVector: false },
    ];
    const count = 1;
    const data = generateInsertData(fields, count);
    expect(data[0].field2.length).toBeGreaterThanOrEqual(2);
    expect(data[0].field2.length).toBeLessThanOrEqual(15);
  });

  it('should generate integer data with the correct range', () => {
    const fields = [
      { name: 'field1', isVector: false },
      { name: 'field2', isVector: false },
      { name: 'field3', isVector: false },
    ];
    const count = 1;
    const data = generateInsertData(fields, count);
    expect(data[0].field1).toBeGreaterThanOrEqual(0);
    expect(data[0].field1).toBeLessThanOrEqual(100000);
  });
});
