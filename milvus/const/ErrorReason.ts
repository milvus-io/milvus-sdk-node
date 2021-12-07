export enum ERROR_REASONS {
  MILVUS_ADDRESS_IS_REQUIRED = "Milvus addres is required.",

  CREATE_COLLECTION_CHECK_PARAMS = "fields and collection_name is needed",
  CREATE_COLLECTION_CHECK_PRIMARY_KEY = "Fields must contain one data_type = int64 and is_primary_key = true",
  CREATE_COLLECTION_CHECK_VECTOR_FIELD_EXIST = "Fields must contain one vector field column",
  CREATE_COLLECTION_CHECK_MISS_DIM = "Vector field need dim in type params",
  CREATE_COLLECTION_CHECK_BINARY_DIM = "Binary vector field dim need mutiples of 8",

  COLLECTION_NAME_IS_REQUIRED = "Collection name is required",
  COLLECTION_PARTITION_NAME_ARE_REQUIRED = "Collection and partition name are required",

  INSERT_CHECK_MISS_FIELD = "Insert fail: missing some field for this collection in line ",
  INSERT_CHECK_FILEDS_DATA_IS_REQUIRED = "fields_data is required as array.",
  INSERT_CHECK_WRONG_FIELD = "Insert fail: some field is not exist for this collection in line",
  INSERT_CHECK_WRONG_DIM = "Insert fail: Binary vector data length need to equal (dimension / 8) ",
  INSERT_CHECK_WRONG_DATA_TYPE = "Some field type in collection schema is not belong to DataType.  ",

  SEARCH_MISS_VECTOR_TYPE = "Miss vector_type, need to be binary or float vector field type.",
  SEARCH_NOT_FIND_VECTOR_FIELD = "Your anns_field cannot find in this collection.",
  SEARCH_DIM_NOT_MATCH = "Your vector dimension is not match your anns_field dimension",
  SEARCH_PARAMS_IS_REQUIRED = "search_params must contains anns_field, metric_type, topk and params.",

  DELETE_PARAMS_CHECK = "Collection name and expr is required.",

  GET_METRIC_CHECK_PARAMS = "request.metric_type is required.",

  GET_FLUSH_STATE_CHECK_PARAMS = "segmentIDs is required as array",

  CREATE_INDEX_PARAMS_REQUIRED = "field_name and extra_params are required",

  PARTITION_NAMES_IS_REQUIRED = "partition_names is required",

  ALIAS_NAME_IS_REQUIRED = "alias is required",
}
