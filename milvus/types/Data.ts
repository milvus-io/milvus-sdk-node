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
  RANKER_TYPE,
} from '../';

// all value types supported by milvus
export type FloatVector = number[];
export type Float16Vector = number[];
export type BFloat16Vector = number[];
export type BinaryVector = number[];
export type SparseFloatVector = { [key: string]: number };
export type VectorTypes =
  | FloatVector
  | Float16Vector
  | BinaryVector
  | BFloat16Vector
  | SparseFloatVector;
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
  | FloatVector
  | Float16Vector
  | BFloat16Vector
  | BinaryVector
  | SparseFloatVector;

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
  collection_names: string[]; // collection names
}

export interface CountReq extends collectionNameReq {
  expr?: string; // filter expression
}

export interface InsertReq extends collectionNameReq {
  partition_name?: string; // partition name
  data?: RowData[]; // data to insert
  fields_data?: RowData[]; // alias for data
  hash_keys?: Number[]; // user can generate hash value depend on primarykey value
}

export interface DeleteEntitiesReq extends collectionNameReq {
  filter?: string; // filter expression
  expr?: string; // alias for filter
  partition_name?: string; // partition name
}

export interface DeleteByIdsReq extends collectionNameReq {
  ids: string[] | number[]; // primary key values
  partition_name?: string; // partition name
}

export interface DeleteByFilterReq extends collectionNameReq {
  filter: string; // filter expression
  partition_name?: string; // partition name
}

export type DeleteReq = DeleteByIdsReq | DeleteByFilterReq;

export interface CalcDistanceReq extends GrpcTimeOut {
  op_left: any;
  op_right: any;
  params: { key: string; value: string }[];
}

export interface GetFlushStateReq extends GrpcTimeOut {
  segmentIDs: number[]; // segment id array
}

export interface LoadBalanceReq extends GrpcTimeOut {
  src_nodeID: number; // The source query node id to balance.
  dst_nodeIDs?: number[]; // The destination query node ids to balance.
  sealed_segmentIDs?: number[]; // Sealed segment ids to balance.
}

export interface GetQuerySegmentInfoReq extends GrpcTimeOut {
  collectionName: string; // its collectioName, this is not colleciton_name :<
}

export interface GePersistentSegmentInfoReq extends GrpcTimeOut {
  collectionName: string; // its collectioName, this is not colleciton_name:<
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
  topk: string | number; // how many results you want
  metric_type: string; // distance metric type
  params: string; // extra search parameters
  offset?: number; // skip how many results
  round_decimal?: number; // round decimal
  ignore_growing?: boolean; // ignore growing
  group_by_field?: string; // group by field
}

// old search api parameter type
export interface SearchReq extends collectionNameReq {
  anns_field?: string; // your vector field name
  partition_names?: string[]; // partition names
  expr?: string; // filter expression
  search_params: SearchParam; // search parameters
  vectors: number[][]; // vectors to search
  output_fields?: string[]; // fields to return
  travel_timestamp?: string; // time travel
  vector_type: DataType.BinaryVector | DataType.FloatVector; // vector field type
  nq?: number; // number of query vectors
  consistency_level?: ConsistencyLevelEnum; // consistency level
}

// simplified search api parameter type
export interface SearchSimpleReq extends collectionNameReq {
  partition_names?: string[]; // partition names
  anns_field?: string; // your vector field name
  data?: number[][] | number[]; // vector to search
  vector?: number[]; // alias for data
  vectors?: number[][]; // alias for data
  output_fields?: string[];
  limit?: number; // how many results you want
  topk?: number; // limit alias
  offset?: number; // skip how many results
  filter?: string; // filter expression
  expr?: string; // alias for filter
  params?: keyValueObj; // extra search parameters
  metric_type?: string; // distance metric type
  consistency_level?: ConsistencyLevelEnum; // consistency level
  ignore_growing?: boolean; // ignore growing
  group_by_field?: string; // group by field
  round_decimal?: number; // round decimal
}

export type HybridSearchSingleReq = Pick<
  SearchParam,
  'anns_field' | 'ignore_growing' | 'group_by_field'
> & {
  data: number[]; // vector to search
  expr?: string; // filter expression
  params?: keyValueObj; // extra search parameters
};

// rerank strategy and parameters
export type RerankerObj = {
  strategy: RANKER_TYPE | string; // rerank strategy
  params: keyValueObj; // rerank parameters
};

// hybrid search api parameter type
export type HybridSearchReq = Omit<
  SearchSimpleReq,
  'data' | 'vector' | 'vectors' | 'params' | 'anns_field'
> & {
  // search requests
  data: HybridSearchSingleReq[];

  // reranker
  rerank?: RerankerObj;
};

// search api response type
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
    group_by_field_value: string;
  };
}

export interface QueryReq extends collectionNameReq {
  output_fields?: string[]; // fields to return
  partition_names?: string[]; // partition names
  ids?: string[] | number[]; // primary key values
  expr?: string; // filter expression
  filter?: string; // alias for expr
  offset?: number; // skip how many results
  limit?: number; // how many results you want
  consistency_level?: ConsistencyLevelEnum; // consistency level
}

export interface GetReq extends collectionNameReq {
  ids: string[] | number[]; // primary key values
  output_fields?: string[]; // fields to return
  partition_names?: string[]; // partition names
  offset?: number; // skip how many results
  limit?: number; // how many results you want
  consistency_level?: ConsistencyLevelEnum; // consistency level
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
  index_name: string; // index name
}

export interface ListIndexedSegmentResponse extends resStatusResponse {
  segmentIDs: number[]; // indexed segment id array
}

export interface DescribeSegmentIndexDataReq extends collectionNameReq {
  index_name: string; // index name
  segmentsIDs: number[]; // segment id array
}

export interface DescribeSegmentIndexDataResponse extends resStatusResponse {
  index_params: any; // index parameters
  index_data: any; // index data
}
