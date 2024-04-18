import {
  ERROR_REASONS,
  FieldType,
  DataType,
  convertToDataType,
  MAX_PARTITIONS_NUMBER,
  MAX_PARTITION_KEY_FIELD_COUNT,
  CreateColReq,
  CreateCollectionReq,
  CreateColWithSchemaAndIndexParamsReq,
  CreateCollectionWithFieldsReq,
  CreateCollectionWithSchemaReq,
} from '../';
import { status as grpcStatus } from '@grpc/grpc-js';

/**
 * when create collection, field must contain 2 Fields.
 * Type is int64 or varchar and primary_key = true
 * Type is one of float_vector and binary_vector
 * Will check fields
 * @param fields
 */
export const checkCollectionFields = (fields: FieldType[]) => {
  const int64VarCharTypes = [DataType.Int64, DataType.VarChar];

  let hasPrimaryKey = false;
  let hasVectorField = false;
  let partitionKeyCount = 0;

  fields.forEach(field => {
    if (!field.hasOwnProperty('data_type')) {
      throw new Error(ERROR_REASONS.CREATE_COLLECTION_MISS_DATA_TYPE);
    }

    // get data type
    const dataType = convertToDataType(field.data_type);
    const isPrimaryKey = field.is_primary_key;
    const isPartitionKey = field.is_partition_key;

    if (isPrimaryKey && int64VarCharTypes.includes(dataType!)) {
      hasPrimaryKey = true;
    }

    // if partition key is set, it should be set on int64 or varchar and non-primary key field
    if (isPartitionKey) {
      if (!int64VarCharTypes.includes(dataType!) || isPrimaryKey) {
        throw new Error(ERROR_REASONS.INVALID_PARTITION_KEY_FIELD_TYPE);
      }
    }

    // if this is the partition key field, check the limit
    if (isPartitionKey) {
      partitionKeyCount++;
    }

    // if this is the vector field, check dimension
    const isVectorField = isVectorType(dataType!);
    const typeParams = field.type_params;
    if (isVectorField) {
      const dim = Number(typeParams?.dim ?? field.dim);
      if (!dim && dataType !== DataType.SparseFloatVector) {
        throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_MISS_DIM);
      }

      if (dataType === DataType.BinaryVector && dim % 8 !== 0) {
        throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_BINARY_DIM);
      }

      hasVectorField = true;
    }

    // if this is a varchar field, check max_length
    if (dataType === DataType.VarChar) {
      const maxLength = typeParams?.max_length ?? field.max_length;
      if (!maxLength) {
        throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_MISS_MAX_LENGTH);
      }
    }
  });

  // if no primary key field is found, throw error
  if (!hasPrimaryKey) {
    throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_PRIMARY_KEY);
  }

  // if no vector field is found, throw error
  if (!hasVectorField) {
    throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_VECTOR_FIELD_EXIST);
  }

  if (partitionKeyCount > MAX_PARTITION_KEY_FIELD_COUNT) {
    throw new Error(ERROR_REASONS.PARTITION_KEY_FIELD_MAXED_OUT);
  }

  return true;
};

/**
 * check if the request contains collection_name
 * otherwise throw an error
 * @param data
 */
export const checkCollectionName = (data: any) => {
  if (!data || !data.collection_name) {
    throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
  }
};

/**
 * check if the request contains collection_name and partition_name
 * otherwise throw an error
 * @param data
 */
export const checkCollectionAndPartitionName = (data: any) => {
  if (!data || !data.collection_name || !data.partition_name) {
    throw new Error(ERROR_REASONS.COLLECTION_PARTITION_NAME_ARE_REQUIRED);
  }
};

/**
 * Checks the validity of search parameters.
 * @param {Object} data - The search parameters to be checked.
 * @throws {Error} Throws an error if any of the search parameters are invalid.
 */
export const checkSearchParams = (data: any) => {
  checkCollectionName(data);

  if (!data.vectors && !data.vector && !data.data) {
    throw new Error(ERROR_REASONS.VECTORS_OR_VECTOR_IS_MISSING);
  }
};

/**
 * Checks if a gRPC status code matches any of the given codes.
 * DEADLINE_EXCEEDED means that the task wat not completed
 * UNAVAILABLE means that the service is not reachable currently
 * Reference: https://grpc.github.io/grpc/python/grpc.html#grpc-status-code
 *
 * @param {number} code - The gRPC status code to check.
 * @param {number[]} [codesToCheck=[grpcStatus.DEADLINE_EXCEEDED, grpcStatus.UNAVAILABLE]] - An array of gRPC status codes to check against.
 * @returns {boolean} Whether the gRPC status code matches any of the given codes.
 */
export const isInIgnoreRetryCodes = (
  code: number,
  codesToCheck: number[] = [
    grpcStatus.DEADLINE_EXCEEDED,
    grpcStatus.PERMISSION_DENIED,
    grpcStatus.UNAUTHENTICATED,
    grpcStatus.INVALID_ARGUMENT,
    grpcStatus.ALREADY_EXISTS,
    grpcStatus.RESOURCE_EXHAUSTED,
    grpcStatus.UNIMPLEMENTED,
    grpcStatus.OK,
  ]
): boolean => {
  return codesToCheck.includes(code);
};

/**
 * Checks if a milvus status message is valid.
 */
export const isInvalidMessage = (
  message: {
    code: number;
    status?: { code: number };
  },
  codesToCheck: number[] = []
) => {
  return (
    message &&
    codesToCheck.some(
      code =>
        code === message.code ||
        (message.status && code === message.status.code)
    )
  );
};

/**
 * Validates the number of partitions.
 * @param {number} num_partitions - The number of partitions to validate.
 * @throws {Error} Throws an error if the number of partitions is invalid.
 */
export const validatePartitionNumbers = (num_partitions: number) => {
  if (num_partitions < 1 || num_partitions > MAX_PARTITIONS_NUMBER) {
    throw new Error(ERROR_REASONS.INVALID_PARTITION_NUM);
  }
};

/**
 * Checks if the provided data is compatible with the current version of the SDK and server.
 * @param {CreateColReq | CreateCollectionReq} data - The data to check for compatibility.
 * @throws {Error} Throws an error if the SDK and server are incompatible.
 */
export const checkCreateCollectionCompatibility = (
  data:
    | CreateColReq
    | CreateColWithSchemaAndIndexParamsReq
    | CreateCollectionReq
) => {
  const hasDynamicSchemaEnabled =
    (data as CreateColReq).enableDynamicField ||
    (data as CreateCollectionReq).enable_dynamic_field;

  if (hasDynamicSchemaEnabled) {
    throw new Error(
      `Your milvus server doesn't support dynamic schema, please upgrade your server.`
    );
  }

  const fields =
    (data as CreateCollectionWithFieldsReq).fields ||
    (data as CreateCollectionWithSchemaReq).schema;

  if (fields.some(f => f.is_partition_key === true)) {
    throw new Error(
      `Your milvus server doesn't support partition key, please upgrade your server.`
    );
  }

  const hasJSONField = fields.some(
    f => f.data_type === 'JSON' || f.data_type === DataType.JSON
  );

  if (hasJSONField) {
    throw new Error(
      `Your milvus server doesn't support JSON data type, please upgrade your server.`
    );
  }
};

/**
 * Checks if the given data type is a vector type.
 * @param {DataType} type - The data type to check.
 * @returns {Boolean} True if the data type is a vector type, false otherwise.
 */
export const isVectorType = (type: DataType) => {
  return (
    type === DataType.BinaryVector ||
    type === DataType.FloatVector ||
    type === DataType.Float16Vector ||
    type === DataType.BFloat16Vector ||
    type === DataType.SparseFloatVector
  );
};
