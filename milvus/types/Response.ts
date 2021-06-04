import { KeyValuePair } from "./Common";
export enum ErrorCode {
  SUCCESS = "Success",
  UNEXPECTED_ERROR = "UnexpectedError",
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

export interface ResStatus {
  error_code: string;
  reason: string;
}

export interface BoolResponse {
  status: ResStatus;
  value: Boolean;
}

export interface ShowCollectionsResponse {
  status: ResStatus;
  collection_names: string[];
}

export interface FieldSchema {
  name: string;
  description: string;
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
