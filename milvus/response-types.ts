export enum ErrorCode {
  SUCCESS = "SUCCESS",
  UNEXPECTED_ERROR = "UNEXPECTED_ERROR",
  CONNECT_FAILED = "CONNECT_FAILED",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  COLLECTION_NOT_EXISTS = "COLLECTION_NOT_EXISTS",
  ILLEGAL_ARGUMENT = "ILLEGAL_ARGUMENT",
  ILLEGAL_DIMENSION = "ILLEGAL_DIMENSION",
  ILLEGAL_INDEX_TYPE = "ILLEGAL_INDEX_TYPE",
  ILLEGAL_COLLECTION_NAME = "ILLEGAL_COLLECTION_NAME",
  ILLEGAL_TOPK = "ILLEGAL_TOPK",
  ILLEGAL_ROWRECORD = "ILLEGAL_ROWRECORD",
  ILLEGAL_VECTOR_ID = "ILLEGAL_VECTOR_ID",
  ILLEGAL_SEARCH_RESULT = "ILLEGAL_SEARCH_RESULT",
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  META_FAILED = "META_FAILED",
  CACHE_FAILED = "CACHE_FAILED",
  CANNOT_CREATE_FOLDER = "CANNOT_CREATE_FOLDER",
  CANNOT_CREATE_FILE = "CANNOT_CREATE_FILE",
  CANNOT_DELETE_FOLDER = "CANNOT_DELETE_FOLDER",
  CANNOT_DELETE_FILE = "CANNOT_DELETE_FILE",
  BUILD_INDEX_ERROR = "BUILD_INDEX_ERROR",
  ILLEGAL_NLIST = "ILLEGAL_NLIST",
  ILLEGAL_METRIC_TYPE = "ILLEGAL_METRIC_TYPE",
  OUT_OF_MEMORY = "OUT_OF_MEMORY",
}

export interface Status {
  error_code: ErrorCode;
  reason: string;
}

interface StatusReply {
  status: Status;
}
interface RowRecord {
  float_data: number[];
  binary_data: number[];
}

export interface BoolReply extends StatusReply {
  bool_reply: boolean;
}

export interface CollectionNameList extends StatusReply {
  collection_names: string[];
}

export interface CollectionRowCount extends StatusReply {
  collection_row_count: number;
}

export interface CollectionInfo extends StatusReply {
  json_info: string;
}

export interface PartitionList extends StatusReply {
  partition_tag_array: string[];
}

export interface VectorIds extends StatusReply {
  vector_id_array: number[];
}

export interface VectorsData extends StatusReply {
  vectors_data: RowRecord[];
}

export interface TopKQueryResult extends StatusReply {
  row_num: number;
  ids: number[];
  distances: number[];
}
