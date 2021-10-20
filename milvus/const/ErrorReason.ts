export enum ERROR_REASONS {
  CREATE_COLLECTION_CHECK_COLLECTION_NAME = "fields and collection_name is needed",
  CREATE_COLLECTION_CHECK_PRIMARY_KEY = "Fields must contain one data_type = int64 and is_primary_key = true",
  CREATE_COLLECTION_CHECK_VECTOR_FIELD_EXIST = "Fields must contain one vector field column",
  CREATE_COLLECTION_CHECK_MISS_DIM = "Vector field need dim in type params",
  CREATE_COLLECTION_CHECK_BINARY_DIM = "Binary vector field dim need mutiples of 8",

  HAS_COLLECTION_CHECK = "Collection name is required",

  INSERT_CHECK_MISS_FIELD = "Insert fail: missing some field for this collection in line ",
  INSERT_CHECK_WRONG_FIELD = "Insert fail: some field is not exist for this collection in line",
  INSERT_CHECK_WRONG_DIM = "Insert fail: Binary vector data length need to equal (dimension / 8) ",

  SEARCH_MISS_VECTOR_TYPE = "Miss vector_type, need to be binary or float vector field type.",
  SEARCH_NOT_FIND_VECTOR_FIELD = "Your anns_field cannot find in this collection.",
  SEARCH_DIM_NOT_MATCH = "Your vector dimension is not match your anns_field dimension",

  DELETE_PARAMS_CHECK = "Collection name and expr is required.",
}
