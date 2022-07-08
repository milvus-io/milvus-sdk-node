import { ERROR_REASONS } from '../const/ErrorReason';
import { FieldType } from '../types/Collection';
import { DataType } from '../types/Common';

/**
 * when create collection, field must contain 2 Fields.
 * Type is int64 or varchar and primary_key = true
 * Type is one of float_vector and binary_vector
 * Will check fields
 * @param fields
 */
export const checkCollectionFields = (fields: FieldType[]) => {
  const vectorTypes = [DataType.BinaryVector, DataType.FloatVector];
  // primary key only support DataType.Int64 and varchar
  const primaryTypes = [DataType.Int64, DataType.VarChar];
  if (
    !fields.find(
      v => v.data_type && primaryTypes.includes(v.data_type) && v.is_primary_key
    )
  ) {
    throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_PRIMARY_KEY);
  }
  if (
    !fields.find(v => (v.data_type ? vectorTypes.includes(v.data_type) : false))
  ) {
    throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_VECTOR_FIELD_EXIST);
  }

  fields.forEach(v => {
    if (v.data_type && vectorTypes.includes(v.data_type)) {
      const dim = v.type_params ? v.type_params.dim : undefined;
      if (!dim) {
        throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_MISS_DIM);
      }
      if (v.data_type === DataType.BinaryVector && Number(dim) % 8 > 0) {
        throw new Error(ERROR_REASONS.CREATE_COLLECTION_CHECK_BINARY_DIM);
      }
    }
  });

  return true;
};
