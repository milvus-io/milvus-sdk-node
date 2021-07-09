import {
  DataType,
  IndexState,
  KeyValuePair,
  NumberArrayId,
  StringArrayId,
} from "./Common";
export enum ErrorCode {
  SUCCESS = "Success",
  INDEX_NOT_EXIST = "IndexNotExist",
  // UNEXPECTED_ERROR = "UnexpectedError",
  // CONNECT_FAILED = "CONNECT_FAILED",
  // PERMISSION_DENIED = "PERMISSION_DENIED",
  // COLLECTION_NOT_EXISTS = "COLLECTION_NOT_EXISTS",
  // ILLEGAL_ARGUMENT = "ILLEGAL_ARGUMENT",
  // ILLEGAL_DIMENSION = "ILLEGAL_DIMENSION",
  // ILLEGAL_INDEX_TYPE = "ILLEGAL_INDEX_TYPE",
  // ILLEGAL_COLLECTION_NAME = "ILLEGAL_COLLECTION_NAME",
  // ILLEGAL_TOPK = "ILLEGAL_TOPK",
  // ILLEGAL_ROWRECORD = "ILLEGAL_ROWRECORD",
  // ILLEGAL_VECTOR_ID = "ILLEGAL_VECTOR_ID",
  // ILLEGAL_SEARCH_RESULT = "ILLEGAL_SEARCH_RESULT",
  // FILE_NOT_FOUND = "FILE_NOT_FOUND",
  // META_FAILED = "META_FAILED",
  // CACHE_FAILED = "CACHE_FAILED",
  // CANNOT_CREATE_FOLDER = "CANNOT_CREATE_FOLDER",
  // CANNOT_CREATE_FILE = "CANNOT_CREATE_FILE",
  // CANNOT_DELETE_FOLDER = "CANNOT_DELETE_FOLDER",
  // CANNOT_DELETE_FILE = "CANNOT_DELETE_FILE",
  // BUILD_INDEX_ERROR = "BUILD_INDEX_ERROR",
  // ILLEGAL_NLIST = "ILLEGAL_NLIST",
  // ILLEGAL_METRIC_TYPE = "ILLEGAL_METRIC_TYPE",
  // OUT_OF_MEMORY = "OUT_OF_MEMORY",
}

export interface ResStatus {
  error_code: string | number;
  reason: string;
}

export interface BoolResponse {
  status: ResStatus;
  value: Boolean;
}

export interface ShowCollectionsResponse {
  status: ResStatus;
  collection_names: string[];
  collection_ids: string[];
}

export interface FieldSchema {
  name: string;
  description: string;
  data_type: string;
  is_primary_key?: boolean;
  type_params: KeyValuePair[];
  index_params: KeyValuePair[];
}

export interface CollectionSchema {
  name: string;
  description: string;
  autoID: boolean;
  fields: FieldSchema[];
}

export interface DescribeCollectionResponse {
  status: ResStatus;
  schema: CollectionSchema;
  collectionID: string;
  virtual_channel_names: string[]; // not useful for now
  physical_channel_names: string[]; // not useful for now
}

export interface StatisticsResponse {
  status: ResStatus;
  stats: KeyValuePair[];
}

export interface ShowPartitionsResponse {
  status: ResStatus;
  partition_names: string[];
  partitionIDs: number[];
}

interface IndexDescription {
  index_name: string;
  indexID: number;
  params: KeyValuePair[];
  field_name: string;
}
export interface DescribeIndexResponse {
  status: ResStatus;
  index_descriptions: IndexDescription[];
}

export interface GetIndexStateResponse {
  status: ResStatus;
  state: IndexState;
}

export interface GetIndexBuildProgressResponse {
  status: ResStatus;
}

export interface MutationResult {
  succ_index: Number[];
  err_index: Number[];
  status: ResStatus;
  acknowledged: boolean;
  insert_cnt: string;
  delete_cnt: string;
  upsert_cnt: string;
  timestamp: string;
  IDs: StringArrayId | NumberArrayId;
}

interface FieldData {
  type: DataType;
  field_name: string;
  scalars?: { [x: string]: any };
  vectors?: {
    dim: number;
    float_vector?: {
      data: number[];
    };
    binary_vector?: any;
  };
}
export interface SearchResultData {
  score: number;
  id: string;
  fields: { type: string; field_name: string; data: string }[];
}

export interface SearchResults {
  status: ResStatus;
  results: SearchResultData[];
}
