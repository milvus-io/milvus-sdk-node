import {
  GrpcTimeOut,
  KeyValuePair,
  ResStatus,
  NumberArrayId,
  StringArrayId,
  keyValueObj,
  DataType,
  SegmentState,
  ImportState,
  ConsistencyLevelEnum,
} from '../';

export interface FlushReq extends GrpcTimeOut {
  collection_names: string[];
}
export interface FieldData {
  type: DataType;
  field_name: string;
  dim?: number;
  data: Number[];
}

export interface InsertReq extends GrpcTimeOut {
  collection_name: string;
  partition_name?: string;
  fields_data?: { [x: string]: any }[];
  data?: { [x: string]: any }[];
  hash_keys?: Number[]; // user can generate hash value depend on primarykey value
}

export interface DeleteEntitiesReq extends GrpcTimeOut {
  collection_name: string;
  expr?: string;
  filter?: string;
  partition_name?: string;
}

export interface DeleteReq extends GrpcTimeOut {
  collection_name: string;
  ids: string[] | number[];
  partition_name?: string;
}

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

export interface ImportReq extends GrpcTimeOut {
  collection_name: string;
  partition_name?: string;
  channel_names?: string[];
  files: string[];
  options?: KeyValuePair[];
}

export interface ListImportTasksReq extends GrpcTimeOut {
  collection_name: string; // target collection, list all tasks if the name is empty
  limit?: number; // maximum number of tasks returned, list all tasks if the value is 0
}

export interface GetImportStateReq extends GrpcTimeOut {
  task: number;
}

export interface GetFlushStateResponse {
  status: ResStatus;
  flushed: boolean;
}

export interface GetMetricsResponse {
  status: ResStatus;
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

export interface GetQuerySegmentInfoResponse {
  status: ResStatus;
  infos: QuerySegmentInfo[];
}

export interface GePersistentSegmentInfoResponse {
  status: ResStatus;
  infos: PersistentSegmentInfo[];
}

export interface MutationResult {
  succ_index: Number[];
  err_index: Number[];
  status: ResStatus;
  acknowledged: boolean;
  insert_cnt: string;
  delete_cnt: string;
  upsert_cnt: string;
  timestamp: string; // we can use it do time travel
  IDs: StringArrayId | NumberArrayId;
}

export interface QueryResults {
  status: ResStatus;
  data: { [x: string]: any }[];
}

export interface SearchResultData {
  [x: string]: any;
  score: number;
  id: string;
}

export interface SearchResults {
  status: ResStatus;
  results: SearchResultData[];
}

export interface ImportResponse {
  status: ResStatus;
  tasks: number[];
}

export interface GetImportStateResponse {
  status: ResStatus;
  state: ImportState;
  row_count: number;
  id_list: number[];
  infos: KeyValuePair[];
  id: number;
  collection_id: number;
  segment_ids: number[];
  create_ts: number;
}

export interface ListImportTasksResponse {
  status: ResStatus;
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

export interface SearchSimpleReq extends GrpcTimeOut {
  collection_name: string;
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

export interface SearchReq extends GrpcTimeOut {
  collection_name: string;
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

export interface SearchRes {
  status: ResStatus;
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

export interface QueryReq extends GrpcTimeOut {
  collection_name: string;
  output_fields?: string[];
  partition_names?: string[];
  expr?: string;
  filter?: string;
  offset?: number;
  limit?: number;
  consistency_level?: ConsistencyLevelEnum;
}

export interface GetReq extends GrpcTimeOut {
  collection_name: string;
  ids: string[] | number[];
  output_fields?: string[];
  partition_names?: string[];
  offset?: number;
  limit?: number;
  consistency_level?: ConsistencyLevelEnum;
}

export interface QueryRes {
  status: ResStatus;
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

export interface FlushResult {
  status: ResStatus;
  coll_segIDs: any; // collection segment id array
}
