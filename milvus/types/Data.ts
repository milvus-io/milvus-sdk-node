import {
  GrpcTimeOut,
  NumberArrayId,
  StringArrayId,
  keyValueObj,
  DataType,
  ConsistencyLevelEnum,
  collectionNameReq,
  resStatusResponse,
  OutputTransformers,
} from '../';

export interface CountReq extends collectionNameReq {
  expr?: string; // filter expression
}

interface BaseDeleteReq extends collectionNameReq {
  partition_name?: string; // partition name
  consistency_level?:
    | 'Strong'
    | 'Session'
    | 'Bounded'
    | 'Eventually'
    | 'Customized'; // consistency level
  exprValues?: keyValueObj; // template values for filter expression, eg: {key: 'value'}
}

export type DeleteEntitiesReq = BaseDeleteReq &
  ({ expr?: string; filter?: never } | { filter?: string; expr?: never });

export interface DeleteByIdsReq extends BaseDeleteReq {
  ids: string[] | number[]; // primary key values
}

export interface DeleteByFilterReq extends BaseDeleteReq {
  filter: string; // filter expression
}

export type DeleteReq = DeleteByIdsReq | DeleteByFilterReq;

export interface CalcDistanceReq extends GrpcTimeOut {
  op_left: any;
  op_right: any;
  params: { key: string; value: string }[];
}

export interface GetFlushStateResponse extends resStatusResponse {
  flushed: boolean;
}

export interface GetMetricsResponse extends resStatusResponse {
  response: any;
  component_name: string; // metrics from which component
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
  data: Record<string, any>[];
}

export interface CountResult extends resStatusResponse {
  data: number;
}

export interface GetMetricsRequest extends GrpcTimeOut {
  request: {
    metric_type: 'system_info' | 'system_statistics' | 'system_log';
  };
}

type BaseQueryReq = collectionNameReq & {
  output_fields?: string[]; // fields to return
  partition_names?: string[]; // partition names
  ids?: string[] | number[]; // primary key values
  expr?: string; // filter expression, or template string, eg: "key = {key}"
  filter?: string; // alias for expr
  offset?: number; // skip how many results
  limit?: number; // how many results you want
  consistency_level?: ConsistencyLevelEnum; // consistency level
  transformers?: OutputTransformers; // provide custom data transformer for specific data type like bf16 or f16 vectors
  exprValues?: keyValueObj; // template values for filter expression, eg: {key: 'value'}
};

export type QueryReq = BaseQueryReq &
  ({ expr?: string; filter?: never } | { filter?: string; expr?: never });

export interface QueryIteratorReq
  extends Omit<QueryReq, 'ids' | 'offset' | 'limit'> {
  limit?: number; // Optional. Specifies the maximum number of items. Default is no limit (-1 or if not set).
  batchSize: number; // Specifies the number of items to return in each batch. if it exceeds 16384, it will be set to 16384
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
    is_dynamic: boolean;
    valid_data: boolean[];
  }[];
  output_fields: string[];
  collection_name: string;
}
