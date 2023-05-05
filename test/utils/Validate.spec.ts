import { status as grpcStatus } from '@grpc/grpc-js';
import {
  checkSearchParams,
  isStatusCodeMatched,
  ERROR_REASONS,
  checkCollectionFields,
  checkTimeParam,
  DataType,
  FieldType,
} from '../../milvus';

describe('utils/validate', () => {
  it('throws an error if vectors and vector are undefined', () => {
    const data = {
      collection_name: 'my_collection',
    };

    expect(() => checkSearchParams(data)).toThrowError(
      ERROR_REASONS.VECTORS_OR_VECTOR_IS_MISSING
    );
  });

  it('does not throw an error if vectors or vector is defined', () => {
    const data1 = {
      collection_name: 'my_collection',
      vectors: [[]],
    };

    const data2 = {
      collection_name: 'my_collection',
      vector: [],
    };

    expect(() => checkSearchParams(data1)).not.toThrow();
    expect(() => checkSearchParams(data2)).not.toThrow();
  });

  it('should return true if the code matches any of the given codes', () => {
    const code = grpcStatus.DEADLINE_EXCEEDED;
    const codesToCheck = [grpcStatus.DEADLINE_EXCEEDED, grpcStatus.UNAVAILABLE];
    const result = isStatusCodeMatched(code, codesToCheck);
    expect(result).toBe(true);
  });

  it('should return false if the code does not match any of the given codes', () => {
    const code = grpcStatus.OK;
    const codesToCheck = [grpcStatus.DEADLINE_EXCEEDED, grpcStatus.UNAVAILABLE];
    const result = isStatusCodeMatched(code, codesToCheck);
    expect(result).toBe(false);
  });

  it('should return true if the code matches the default codes to check', () => {
    const code = grpcStatus.DEADLINE_EXCEEDED;
    const result = isStatusCodeMatched(code);
    expect(result).toBe(true);
  });

  it('should return false if the code does not match the default codes to check', () => {
    const code = grpcStatus.OK;
    const result = isStatusCodeMatched(code);
    expect(result).toBe(false);
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
});
