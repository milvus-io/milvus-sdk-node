export enum ERROR_REASONS {
  MILVUS_ADDRESS_IS_REQUIRED = 'The `address` property is missing.',

  CREATE_COLLECTION_MISS_DATA_TYPE = 'The `data_type` property is missing in the `field` object.',
  CREATE_COLLECTION_CHECK_PARAMS = 'The `fields` or `collection_name` property is missing.',
  CREATE_COLLECTION_CHECK_PRIMARY_KEY = 'The `data_type` for the primary key field must be DataType.Int64.',
  CREATE_COLLECTION_CHECK_VECTOR_FIELD_EXIST = 'The `data_type` of a vector field  must be either DataType.FloatVector or DataType.BinaryVector.',
  CREATE_COLLECTION_CHECK_MISS_DIM = 'The `dim` property is missing.',
  CREATE_COLLECTION_CHECK_MISS_MAXLENGTH = 'The `max_length` property is missing',
  CREATE_COLLECTION_CHECK_BINARY_DIM = 'The `dim` property of the Binary vector should be value mutiples of 8.',
  COLLECTION_NAME_IS_REQUIRED = 'The `collection_name` property is missing.',
  COLLECTION_ID_IS_REQUIRED = 'The `collectionID` property is missing.',
  COLLECTION_PARTITION_NAME_ARE_REQUIRED = 'The `collection_name` or the `partition_name` property is missing.',

  INSERT_CHECK_FILEDS_DATA_IS_REQUIRED = 'The type of the `fields_data` should be an array.',
  INSERT_CHECK_WRONG_FIELD = 'Insert fail: some field does not exist for this collection in line.',
  INSERT_CHECK_WRONG_DIM = 'Insert fail: the length of the binary vector should be (dimension / 8).',
  INSERT_CHECK_WRONG_DATA_TYPE = 'The value of the `data_type` property is not supported:',

  DELETE_PARAMS_CHECK = 'The `collection_name` or the `expr` property is missing.',
  GET_METRIC_CHECK_PARAMS = 'The `metric_type` property is missing.',
  GET_FLUSH_STATE_CHECK_PARAMS = 'The type of the `segmentIDs` property should be an array.',
  LOAD_BALANCE_CHECK_PARAMS = 'The `src_nodeID` property is missing.',
  PARTITION_NAMES_IS_REQUIRED = 'The `partition_names` property is missing.',
  ALIAS_NAME_IS_REQUIRED = 'The `alias` property is missing.',
  COMPACTIONID_IS_REQUIRED = 'The `compactionID` property is missing.',
  USERNAME_PWD_ARE_REQUIRED = 'The `username` or `password` property is missing.',
  USERNAME_IS_REQUIRED = 'The `username` property is missing.',
  TIMESTAMP_PARAM_CHECK = 'The type of the `hybridts` property should be string (only contains number) or bigint.',
  DATE_TYPE_CHECK = 'The type of the `datetime` property should be Date.',
  IMPORT_FILE_CHECK = 'The `files` property is missing.',
  SEARCH_PARAMS_IS_NOT_MATCH = 'Some of the search parameters are not match.',
  VECTORS_OR_VECTOR_IS_MISSING = 'The `vector` or `vectors` property is missing.'
}
