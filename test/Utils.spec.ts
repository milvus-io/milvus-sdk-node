import { promisify } from '../utils/index';
import path from 'path';
import {
  getGRPCService,
  getAuthInterceptor,
  checkTimeParam,
  assignTypeParams,
  checkCollectionFields,
} from '../utils';
import { ERROR_REASONS, FieldType, DataType } from '../milvus';
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
  it('should throw an error if a field is missing the data_type property', () => {
    const fields: FieldType[] = [
      {
        name: 'field1',
        is_primary_key: true,
      },
    ];
    expect(() => checkCollectionFields(fields)).toThrowError(
      ERROR_REASONS.CREATE_COLLECTION_MISS_DATA_TYPE
    );
  });

  it('should throw an error if a primary key is missing or has an unsupported data type', () => {
    const fields: FieldType[] = [
      {
        name: 'field1',
        data_type: DataType.Float,
        is_primary_key: true,
      },
    ];
    expect(() => checkCollectionFields(fields)).toThrowError(
      ERROR_REASONS.CREATE_COLLECTION_CHECK_PRIMARY_KEY
    );
  });

  it('should throw an error if a vector field is missing or has an unsupported data type', () => {
    const fields: FieldType[] = [
      {
        name: 'field1',
        data_type: DataType.Int64,
        is_primary_key: true,
      },
    ];
    expect(() => checkCollectionFields(fields)).toThrowError(
      ERROR_REASONS.CREATE_COLLECTION_CHECK_VECTOR_FIELD_EXIST
    );
  });

  it('should throw an error if a vector field is missing the dimension property', () => {
    const fields: FieldType[] = [
      {
        name: 'field1',
        data_type: DataType.BinaryVector,
        is_primary_key: false,
      },
      {
        name: 'field2',
        data_type: DataType.Int64,
        is_primary_key: true,
      },
    ];
    expect(() => checkCollectionFields(fields)).toThrowError(
      ERROR_REASONS.CREATE_COLLECTION_CHECK_MISS_DIM
    );
  });

  it('should throw an error if a binary vector field has a dimension that is not a multiple of 8', () => {
    const fields: FieldType[] = [
      {
        name: 'field1',
        data_type: DataType.BinaryVector,
        is_primary_key: false,
        type_params: {
          dim: 7,
        },
      },
      {
        name: 'field2',
        data_type: DataType.Int64,
        is_primary_key: true,
      },
    ];
    expect(() => checkCollectionFields(fields)).toThrowError(
      ERROR_REASONS.CREATE_COLLECTION_CHECK_BINARY_DIM
    );
  });

  it('should throw an error if a varchar field is missing the max_length property', () => {
    const fields: FieldType[] = [
      {
        name: 'field1',
        data_type: DataType.VarChar,
        is_primary_key: false,
      },
      {
        name: 'field1',
        data_type: DataType.BinaryVector,
        is_primary_key: false,
        type_params: {
          dim: 7,
        },
      },
      {
        name: 'field2',
        data_type: DataType.Int64,
        is_primary_key: true,
      },
    ];
    expect(() => checkCollectionFields(fields)).toThrowError(
      ERROR_REASONS.CREATE_COLLECTION_CHECK_MISS_MAXLENGTH
    );
  });

  it('should return true if all fields are valid', () => {
    const fields: FieldType[] = [
      {
        name: 'field1',
        data_type: DataType.BinaryVector,
        is_primary_key: false,
        type_params: {
          dim: 16,
        },
      },
      {
        name: 'field2',
        data_type: DataType.VarChar,
        is_primary_key: false,
        type_params: {
          max_length: 10,
        },
      },
      {
        name: 'field3',
        data_type: DataType.Int64,
        is_primary_key: true,
      },
    ];
    expect(checkCollectionFields(fields)).toBe(true);
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

  it('should generate data for a collection with a vector field of type DataType.FloatVector', () => {
    const fields = [
      {
        name: 'vector_field',
        description: 'vector field',
        data_type: DataType.FloatVector,
        dim: 10,
      },
      {
        name: 'age',
        description: '',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
    ];
    const data = generateInsertData(fields, 10);
    expect(data.length).toBe(10);
    expect(data[0].vector_field.length).toBe(10);
  });

  it('should generate data for a collection with a vector field of type DataType.BinaryVector', () => {
    const fields = [
      {
        name: 'vector_field',
        description: 'vector field',
        data_type: DataType.BinaryVector,
        dim: 80,
      },
      {
        name: 'age',
        description: '',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
    ];
    const data = generateInsertData(fields, 10);
    expect(data.length).toBe(10);
    expect(data[0].vector_field.length).toBe(10);
  });

  it('should generate data for a collection with a non-vector field of type DataType.Bool', () => {
    const fields = [
      {
        name: 'bool_field',
        description: 'bool field',
        data_type: DataType.Bool,
      },
      {
        name: 'age',
        description: '',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
    ];
    const data = generateInsertData(fields, 10);
    expect(data.length).toBe(10);
    expect(typeof data[0].bool_field).toBe('boolean');
  });

  it('should generate data for a collection with a non-vector field of type DataType.VarChar', () => {
    const fields = [
      {
        name: 'varchar_field',
        description: 'varchar field',
        data_type: DataType.VarChar,
        max_length: 10,
      },
      {
        name: 'age',
        description: '',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
    ];
    const data = generateInsertData(fields, 10);
    expect(data.length).toBe(10);
    expect(typeof data[0].varchar_field).toBe('string');
    expect(data[0].varchar_field.length).toBeLessThanOrEqual(5);
  });

  it('should generate data for a collection with a non-vector field of a data type other than DataType.Bool or DataType.VarChar', () => {
    const fields = [
      {
        name: 'int_field',
        description: 'int field',
        data_type: DataType.Int32,
      },
      {
        name: 'age',
        description: '',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
    ];
    const data = generateInsertData(fields, 10);
    expect(data.length).toBe(10);
    expect(typeof data[0].int_field).toBe('number');
  });
});
