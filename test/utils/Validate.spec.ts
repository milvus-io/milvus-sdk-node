import { status as grpcStatus } from '@grpc/grpc-js';
import {
  checkSearchParams,
  isInIgnoreRetryCodes,
  isInvalidMessage,
  ERROR_REASONS,
  checkCollectionFields,
  checkTimeParam,
  DataType,
  FieldType,
  checkCreateCollectionCompatibility,
  CreateCollectionReq,
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
      data: [[]],
    };

    const data2 = {
      collection_name: 'my_collection',
      data: [],
    };

    expect(() => checkSearchParams(data1)).not.toThrow();
    expect(() => checkSearchParams(data2)).not.toThrow();
  });

  it('code exists in codesToCheck array', () => {
    expect(isInIgnoreRetryCodes(grpcStatus.DEADLINE_EXCEEDED)).toBe(true);
  });

  it('code does not exist in codesToCheck array', () => {
    expect(isInIgnoreRetryCodes(1234)).toBe(false);
  });

  it('omit codesToCheck array', () => {
    // The default codesToCheck array should include all gRPC status codes
    expect(isInIgnoreRetryCodes(grpcStatus.OK)).toBe(true);
    expect(isInIgnoreRetryCodes(1234)).toBe(false);
  });

  it('custom codesToCheck array', () => {
    // Custom codesToCheck array
    const customCodesToCheck = [
      grpcStatus.DEADLINE_EXCEEDED,
      grpcStatus.UNAUTHENTICATED,
      grpcStatus.OK,
    ];

    expect(
      isInIgnoreRetryCodes(grpcStatus.DEADLINE_EXCEEDED, customCodesToCheck)
    ).toBe(true);
    expect(
      isInIgnoreRetryCodes(grpcStatus.PERMISSION_DENIED, customCodesToCheck)
    ).toBe(false);
  });

  it('message is invalid', () => {
    const invalidMessage = {
      code: 1234,
      status: { code: 5678 },
    };
    expect(isInvalidMessage(invalidMessage)).toBe(false);
  });

  it('message code matches codesToCheck', () => {
    const validMessage = {
      code: 2200,
      status: undefined,
    };
    expect(isInvalidMessage(validMessage, [2200])).toBe(true);
  });

  it('message status code matches codesToCheck', () => {
    const validMessage = {
      code: 222,
      status: { code: 2200 },
    };
    expect(isInvalidMessage(validMessage, [2200])).toBe(true);
  });

  it('message code and status code match codesToCheck', () => {
    const validMessage = {
      code: 2200,
      status: { code: 2200 },
    };
    expect(isInvalidMessage(validMessage, [2200])).toBe(true);
  });

  it('should throw an error if a field is missing the data_type property', () => {
    const fields: FieldType[] = [
      {
        name: 'field1',
        is_primary_key: true,
      } as any,
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
        data_type: 'BinaryVector',
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
      ERROR_REASONS.CREATE_COLLECTION_CHECK_MISS_MAX_LENGTH
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

  it('throws an error if the SDK and server are incompatible', () => {
    const data: CreateCollectionReq = {
      collection_name: 'test_collection',
      fields: [
        {
          name: 'test_field',
          data_type: DataType.Int64,
          is_primary_key: true,
        },
        {
          name: 'test_field_2',
          data_type: DataType.BinaryVector,
          is_primary_key: false,
          is_partition_key: false,
          type_params: {
            dim: 128,
          },
        },
        {
          name: 'test_field_3',
          data_type: DataType.JSON,
          is_primary_key: false,
          is_partition_key: false,
        },
      ],
    };

    expect(() => checkCreateCollectionCompatibility(data)).toThrow(
      `Your milvus server doesn't support JSON data type, please upgrade your server.`
    );

    const data2: CreateCollectionReq = {
      collection_name: 'test_collection',
      fields: [
        {
          name: 'test_field',
          data_type: DataType.Int64,
          is_primary_key: true,
        },
        {
          name: 'test_field_2',
          data_type: DataType.BinaryVector,
          is_primary_key: false,
          type_params: {
            dim: 128,
          },
        },
        {
          name: 'test_field_3',
          data_type: DataType.Int64,
          is_primary_key: false,
          is_partition_key: true,
        },
      ],
    };
    expect(() => checkCreateCollectionCompatibility(data2)).toThrow(
      `Your milvus server doesn't support partition key, please upgrade your server.`
    );

    const data3: CreateCollectionReq = {
      collection_name: 'test_collection',
      fields: [
        {
          name: 'test_field',
          data_type: DataType.Int64,
          is_primary_key: true,
        },
        {
          name: 'test_field_2',
          data_type: DataType.BinaryVector,
          is_primary_key: false,
          is_partition_key: true,
          type_params: {
            dim: 128,
          },
        },
      ],
      enable_dynamic_field: true,
    };

    expect(() => checkCreateCollectionCompatibility(data3)).toThrow(
      `Your milvus server doesn't support dynamic schema, please upgrade your server.`
    );
  });

  it('does not throw an error if the SDK and server are compatible', () => {
    const data: CreateCollectionReq = {
      collection_name: 'test_collection',
      fields: [
        {
          name: 'test_field',
          data_type: DataType.Int64,
          is_primary_key: true,
        },
        {
          name: 'test_field_2',
          data_type: DataType.BinaryVector,
          is_primary_key: false,
          is_partition_key: false,
          type_params: {
            dim: 128,
          },
        },
        {
          name: 'test_field_3',
          data_type: DataType.Int32,
          is_primary_key: false,
          is_partition_key: false,
        },
      ],
    };

    expect(() => checkCreateCollectionCompatibility(data)).not.toThrow();
  });
});
