import {
  GrpcTimeOut,
  KeyValuePair,
  NumberArrayId,
  StringArrayId,
  keyValueObj,
  DataType,
  SegmentState,
  ImportState,
  ConsistencyLevelEnum,
  collectionNameReq,
  resStatusResponse,
} from '../';

// all types supported by milvus
export type FloatVectors = number[];
export type BinaryVectors = number[];
export type Vectors = FloatVectors | BinaryVectors;
export type Bool = boolean;
export type Int8 = number;
export type Int16 = number;
export type Int32 = number;
export type Int64 = number;
export type Float = number;
export type Double = number;
export type VarChar = string;
export type JSON = {
  [key: string]: any;
};
export type Array =
  | Int8[]
  | Int16[]
  | Int32[]
  | Int64[]
  | Float[]
  | Double[]
  | VarChar[];

// Represents the possible data types for a field(cell)
export type FieldData =
  | Bool
  | Int8
  | Int16
  | Int32
  | Int64
  | Float
  | Double
  | VarChar
  | JSON
  | Array
  | Vectors
  | FloatVectors
  | BinaryVectors;

// Represents a row of data in Milvus.
export interface RowData {
  [x: string]: FieldData;
}

export interface Field {
  name: string;
  type: keyof typeof DataType;
  elementType?: keyof typeof DataType;
  data: FieldData[];
  dim?: number;
}

export interface FlushReq extends GrpcTimeOut {
  collection_names: string[];
}

export interface CountReq extends collectionNameReq {
  expr?: string;
}

export interface InsertReq extends collectionNameReq {
  partition_name?: string;
  fields_data?: RowData[];
  data?: RowData[];
  hash_keys?: Number[]; // user can generate hash value depend on primarykey value
}

export interface DeleteEntitiesReq extends collectionNameReq {
  expr?: string;
  filter?: string;
  partition_name?: string;
}

export interface DeleteByIdsReq extends collectionNameReq {
  ids: string[] | number[];
  partition_name?: string;
}

export interface DeleteByFilterReq extends collectionNameReq {
  filter: string;
  partition_name?: string;
}

export type DeleteReq = DeleteByIdsReq | DeleteByFilterReq;

export interface CalcDistanceReq extends GrpcTimeOut {
  op_left: any;
  op_right: any;
  params: { key: string; value: string }[];
}

export interface GetFlushStateReq extends GrpcTimeOut {
  segmentIDs: number[];
}

export interface LoadBalanceReq extends GrpcTimeOut {
  // The source query node id to balance.
  src_nodeID: number;
  // The destination query node ids to balance.
  dst_nodeIDs?: number[];
  // Sealed segment ids to balance.
  sealed_segmentIDs?: number[];
}

export interface GetQuerySegmentInfoReq extends GrpcTimeOut {
  collectionName: string;
}

export interface GePersistentSegmentInfoReq extends GrpcTimeOut {
  collectionName: string;
}

export interface ImportReq extends collectionNameReq {
  partition_name?: string;
  channel_names?: string[];
  files: string[];
  options?: KeyValuePair[];
}

export interface ListImportTasksReq extends collectionNameReq {
  limit?: number; // maximum number of tasks returned, list all tasks if the value is 0
}

export interface GetImportStateReq extends GrpcTimeOut {
  task: number;
}

export interface GetFlushStateResponse extends resStatusResponse {
  flushed: boolean;
}

export interface GetMetricsResponse extends resStatusResponse {
  response: any;
  component_name: string; // metrics from which component
}

export interface QuerySegmentInfo {
  segmentID: number;
  collectionID: number;
  partitionID: number;
  mem_size: number;
  num_rows: number;
  index_name: string;
  indexID: number;
  nodeID: number;
  state: SegmentState;
}

export interface PersistentSegmentInfo {
  segmentID: number;
  collectionID: number;
  partitionID: number;
  num_rows: number;
  state: SegmentState;
}

export interface GetQuerySegmentInfoResponse extends resStatusResponse {
  infos: QuerySegmentInfo[];
}

export interface GePersistentSegmentInfoResponse extends resStatusResponse {
  infos: PersistentSegmentInfo[];
}

export interface MutationResult extends resStatusResponse {
  succ_index: Number[];
  err_index: Number[];
  acknowledged: boolean;
  insert_cnt: string;
  delete_cnt: string;
  upsert_cnt: string;
  timestamp: string; // we can use it do time travel
  IDs: StringArrayId | NumberArrayId;
}

export interface QueryResults extends resStatusResponse {
  data: { [x: string]: any }[];
}

export interface CountResult extends resStatusResponse {
  data: number;
}

export interface SearchResultData {
  [x: string]: any;
  score: number;
  id: string;
}

export interface SearchResults extends resStatusResponse {
  results: SearchResultData[];
}

export interface ImportResponse extends resStatusResponse {
  tasks: number[];
}

export interface GetImportStateResponse extends resStatusResponse {
  state: ImportState;
  row_count: number;
  id_list: number[];
  infos: KeyValuePair[];
  id: number;
  collection_id: number;
  segment_ids: number[];
  create_ts: number;
}

export interface ListImportTasksResponse extends resStatusResponse {
  tasks: GetImportStateResponse[];
}

export interface GetMetricsRequest extends GrpcTimeOut {
  request: {
    metric_type: 'system_info' | 'system_statistics' | 'system_log';
  };
}

export interface SearchParam {
  anns_field: string; // your vector field name
  topk: string;
  metric_type: string;
  params: string;
  round_decimal?: number;
  ignore_growing?: boolean;
}

export interface SearchSimpleReq extends collectionNameReq {
  vector?: number[];
  vectors?: number[][];
  data?: number[][] | number[];
  output_fields?: string[];
  limit?: number;
  topk?: number; // alias
  offset?: number;
  filter?: string;
  expr?: string; // alias
  partition_names?: string[];
  params?: keyValueObj;
  metric_type?: string;
  consistency_level?: ConsistencyLevelEnum;
  ignore_growing?: boolean;
}

export interface SearchReq extends collectionNameReq {
  partition_names?: string[];
  expr?: string;
  // dsl_type: DslType;
  search_params: SearchParam;
  vectors: number[][];
  output_fields?: string[];
  travel_timestamp?: string;
  vector_type: DataType.BinaryVector | DataType.FloatVector;
  nq?: number;
  consistency_level?: ConsistencyLevelEnum;
}

export interface SearchRes extends resStatusResponse {
  results: {
    top_k: number;
    fields_data: {
      type: string;
      field_name: string;
      field_id: number;
      field: 'vectors' | 'scalars';
      vectors?: {
        dim: string;
        data: 'float_vector' | 'binary_vector';
        float_vector?: {
          data: number[];
        };
        binary_vector?: Buffer;
      };
      scalars: {
        [x: string]: any;
        data: string;
      };
    }[];
    scores: number[];
    ids: {
      int_id?: {
        data: number[];
      };
      str_id?: {
        data: string[];
      };
      id_field: 'int_id' | 'str_id';
    };
    num_queries: number;
    topks: number[];
    output_fields: string[];
  };
}

export interface QueryReq extends collectionNameReq {
  output_fields?: string[];
  partition_names?: string[];
  ids?: string[] | number[];
  expr?: string;
  filter?: string;
  offset?: number;
  limit?: number;
  consistency_level?: ConsistencyLevelEnum;
}

export interface GetReq extends collectionNameReq {
  ids: string[] | number[];
  output_fields?: string[];
  partition_names?: string[];
  offset?: number;
  limit?: number;
  consistency_level?: ConsistencyLevelEnum;
}

export interface QueryRes extends resStatusResponse {
  fields_data: {
    type: DataType;
    field_name: string;
    field: 'vectors' | 'scalars';
    field_id: number;
    vectors?: {
      dim: string;
      data: 'float_vector' | 'binary_vector';
      float_vector?: {
        data: number[];
      };
      binary_vector?: Buffer;
    };
    scalars?: {
      // long_data: {data: [stringID]}
      [x: string]: any;
      data: string;
    };
  }[];
  output_fields: string[];
  collection_name: string;
}

export interface FlushResult extends resStatusResponse {
  coll_segIDs: any; // collection segment id array
}

export interface ListIndexedSegmentReq extends collectionNameReq {
  index_name: string;
}

export interface ListIndexedSegmentResponse extends resStatusResponse {
  segmentIDs: number[];
}

export interface DescribeSegmentIndexDataReq extends collectionNameReq {
  index_name: string;
  segmentsIDs: number[];
}

export interface DescribeSegmentIndexDataResponse extends resStatusResponse {
  index_params: any;
  index_data: any;
}
