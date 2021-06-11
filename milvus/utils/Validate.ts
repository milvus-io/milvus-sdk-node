import { BAD_REQUEST_CODE } from "../const/ErrorCode";
import { FieldType } from "../types/Collection";
import { DataType } from "../types/Common";

/**
 * when create collection, field must contain 2 Fields.
 * Type is int64 and primary_key = true
 * Type is one of float_vector and binary_vector
 * @param fields
 */
export const checkCollectionFields = (fields: FieldType[]) => {
  if (!fields.find((v) => v.data_type === DataType.Int64 && v.is_primary_key)) {
    return {
      error_code: BAD_REQUEST_CODE,
      reason:
        "Fields must contain one data_type = int64 and is_primary_key = true",
    };
  }
  if (
    !fields.find(
      (v) =>
        v.data_type === DataType.BinaryVector ||
        v.data_type === DataType.FloatVector
    )
  ) {
    return {
      error_code: BAD_REQUEST_CODE,
      reason: "Fields must contain one vector field column",
    };
  }
  return true;
};
