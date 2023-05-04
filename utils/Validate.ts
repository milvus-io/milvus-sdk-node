import { ERROR_REASONS, FieldType, DataType } from '../milvus';
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
  const primaryKeyDataTypes = [DataType.Int64, DataType.VarChar];

  // Check if every field in the `fields` array has a `data_type` property
  const hasDataTypeKey = fields.every(field => {
    return field.hasOwnProperty('data_type');
  });

  // If `hasDataTypeKey` is false, an error is thrown indicating that the `data_type` property is missing
  if (!hasDataTypeKey) {
    throw new Error(ERROR_REASONS.CREATE_COLLECTION_MISS_DATA_TYPE);
  }

  // Check if at least one field in the `fields` array is a primary key with a supported data type
  const hasPrimaryKey = fields.some(field => {
    const isPrimaryKey = field.is_primary_key;
    const isSupportedDataType = primaryKeyDataTypes.includes(field.data_type!);
    return isPrimaryKey && isSupportedDataType;
  });

  // If `hasPrimaryKey` is false, an error is thrown indicating that a primary key is missing or has an unsupported data type
  if (!hasPrimaryKey) {
    throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_PRIMARY_KEY);
  }

  // Check if at least one field in the `fields` array is a vector field with a supported data type
  const hasVectorField = fields.some(field => {
    const isVectorField = vectorDataTypes.includes(field.data_type!);
    return isVectorField;
  });

  // If `hasVectorField` is false, an error is thrown indicating that a vector field is missing or has an unsupported data type
  if (!hasVectorField) {
    throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_VECTOR_FIELD_EXIST);
  }

  fields.forEach(field => {
    const dataType = field.data_type;
    const typeParams = field.type_params;
    const isVectorField = vectorDataTypes.includes(dataType!);

    // Check if field is a vector field
    if (isVectorField) {
      const dim = Number(typeParams?.dim ?? field.dim);
      // Check if vector field has a dimension
      if (!dim) {
        throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_MISS_DIM);
      }

      // Check if binary vector field has a dimension that is a multiple of 8
      if (dataType === DataType.BinaryVector && dim % 8 !== 0) {
        throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_BINARY_DIM);
      }
    }

    // Check if varchar field has a max length
    if (dataType === DataType.VarChar) {
      const maxLength = typeParams?.max_length ?? field.max_length;
      if (!maxLength) {
        throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_MISS_MAXLENGTH);
      }
    }
  });

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
  ]
): boolean => {
  return codesToCheck.includes(code);
};
