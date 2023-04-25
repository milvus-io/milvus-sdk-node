import {
  ERROR_REASONS,
  FieldType,
  DataType,
  SEARCH_ERROR_REASONS,
} from '../milvus';

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

export const checkRoundDecimal = (round_decimal: any) => {
  if (
    round_decimal !== undefined &&
    (!Number.isInteger(round_decimal) ||
      round_decimal < -1 ||
      round_decimal > 6)
  ) {
    throw new Error(ERROR_REASONS.SEARCH_ROUND_DECIMAL_NOT_VALID);
  }
};

export const checkSearchParams = (data: any) => {
  checkCollectionName(data);

  if (!data.vectors && !data.vector) {
    throw new Error(SEARCH_ERROR_REASONS.VECTORS_REQUIRED);
  }

  if (data.partition_names && !Array.isArray(data.partition_names)) {
    throw new Error(SEARCH_ERROR_REASONS.PARTITION_NAMES_ARRAY);
  }

  if (data.vectors) {
    // SearchReq
    if (data.expr && typeof data.expr !== 'string') {
      throw new Error(SEARCH_ERROR_REASONS.EXPR_STRING);
    }
    if (!data.search_params || typeof data.search_params !== 'object') {
      throw new Error(SEARCH_ERROR_REASONS.SEARCH_PARAMS_OBJECT);
    }

    const { anns_field, topk, metric_type, params, round_decimal } =
      data.search_params;

    if (!anns_field || typeof anns_field !== 'string') {
      throw new Error(SEARCH_ERROR_REASONS.ANNS_FIELD_STRING);
    }

    if (!topk || typeof topk !== 'string') {
      throw new Error(SEARCH_ERROR_REASONS.TOPK_STRING);
    }

    if (!metric_type || typeof metric_type !== 'string') {
      throw new Error(SEARCH_ERROR_REASONS.METRIC_TYPE_STRING);
    }

    if (!params || typeof params !== 'string') {
      throw new Error(SEARCH_ERROR_REASONS.PARAMS_STRING);
    }

    if (round_decimal && typeof round_decimal !== 'number') {
      throw new Error(SEARCH_ERROR_REASONS.ROUND_DECIMAL_NUMBER);
    }

    if (
      !data.vector_type ||
      (data.vector_type !== DataType.BinaryVector &&
        data.vector_type !== DataType.FloatVector)
    ) {
      throw new Error(SEARCH_ERROR_REASONS.VECTOR_TYPE_REQUIRED);
    }

    if (data.nq && typeof data.nq !== 'number') {
      throw new Error(SEARCH_ERROR_REASONS.NQ_NUMBER);
    }

    checkRoundDecimal(round_decimal);
  } else {
    // SearchSimpleReq

    if (data.limit && typeof data.limit !== 'number') {
      throw new Error(SEARCH_ERROR_REASONS.LIMIT_NUMBER);
    }

    if (data.offset && typeof data.offset !== 'number') {
      throw new Error(SEARCH_ERROR_REASONS.OFFSET_NUMBER);
    }

    if (data.filter && typeof data.filter !== 'string') {
      throw new Error(SEARCH_ERROR_REASONS.FILTER_STRING);
    }
    if (data.params && typeof data.params !== 'object') {
      throw new Error(SEARCH_ERROR_REASONS.PARAMS_OBJECT);
    }

    if (data.metric_type && typeof data.metric_type !== 'string') {
      throw new Error(SEARCH_ERROR_REASONS.METRIC_TYPE_STRING);
    }

    if (
      data.params &&
      data.params.round_decimal &&
      typeof data.params.round_decimal !== 'number'
    ) {
      throw new Error(SEARCH_ERROR_REASONS.ROUND_DECIMAL_NUMBER);
    }

    if (data.params) {
      checkRoundDecimal(data.params.round_decimal);
    }
  }
};
