import {
  ERROR_REASONS,
  FieldType,
  DataType,
  convertToDataType,
  MAX_PARTITIONS_NUMBER,
  MAX_PARTITION_KEY_FIELD_COUNT,
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
  // Define arrays of data types that are allowed for vector fields and primary keys, respectively
  const vectorDataTypes = [DataType.BinaryVector, DataType.FloatVector];
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
    const isVectorField = vectorDataTypes.includes(dataType!);
    const typeParams = field.type_params;
    if (isVectorField) {
      const dim = Number(typeParams?.dim ?? field.dim);
      if (!dim) {
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

  if (!data.vectors && !data.vector) {
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
export const isStatusCodeMatched = (
  code: number,
  codesToCheck: number[] = [
    grpcStatus.DEADLINE_EXCEEDED,
    grpcStatus.UNAVAILABLE,
    grpcStatus.INTERNAL,
  ]
): boolean => {
  return codesToCheck.includes(code);
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
