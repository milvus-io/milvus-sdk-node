import {
  keyValueObj,
  DataType,
  ConsistencyLevelEnum,
  collectionNameReq,
  resStatusResponse,
  RANKER_TYPE,
  FunctionObject,
  VectorTypes,
  BFloat16Vector,
  Float16Vector,
  SparseVectorDic,
  SparseFloatVector,
  Int8Vector,
} from '../';

export interface SearchParam {
  anns_field: string; // your vector field name
  topk: string | number; // how many results you want
  metric_type: string; // distance metric type
  params: string; // extra search parameters
  offset?: number; // skip how many results
  round_decimal?: number; // round decimal
  ignore_growing?: boolean; // ignore growing
  group_by_field?: string; // group by field
  group_size?: number; // group size
  strict_group_size?: boolean; // if strict group size
  hints?: string; // hints to improve milvus search performance
  [key: string]: any; // extra search parameters
}

// old search api parameter type, deprecated
export interface SearchReq extends collectionNameReq {
  anns_field?: string; // your vector field name
  partition_names?: string[]; // partition names
  expr?: string; // filter expression
  exprValues?: keyValueObj; // template values for filter expression, eg: {key: 'value'}
  search_params: SearchParam; // search parameters
  vectors: VectorTypes[] | [VectorTypes]; // vectors to search
  output_fields?: string[]; // fields to return
  travel_timestamp?: string; // time travel
  vector_type: DataType.BinaryVector | DataType.FloatVector; // vector field type
  nq?: number; // number of query vectors
  consistency_level?: ConsistencyLevelEnum; // consistency level
  transformers?: OutputTransformers; // provide custom data transformer for specific data type like bf16 or f16 vectors
}

export type SearchTextType = string | string[] | [string];
export type SearchVectorType = VectorTypes | VectorTypes[] | [VectorTypes];
export type SearchDataType = SearchVectorType | SearchTextType;
export type SearchMultipleDataType = VectorTypes[] | SearchTextType[];

// simplified search api parameter type
export interface SearchSimpleReq extends collectionNameReq {
  partition_names?: string[]; // partition names
  anns_field?: string; // your vector field name，required if you are searching on multiple vector fields collection
  data?: SearchDataType; // vector or text to search
  vector?: VectorTypes; // alias for data, deprecated
  vectors?: VectorTypes[] | [VectorTypes]; // alias for data, deprecated
  output_fields?: string[];
  limit?: number; // how many results you want
  topk?: number; // limit alias
  offset?: number; // skip how many results
  filter?: string; // filter expression
  expr?: string; // alias for filter
  exprValues?: keyValueObj; // template values for filter expression, eg: {key: 'value'}
  params?: keyValueObj; // extra search parameters
  metric_type?: string; // distance metric type
  consistency_level?: ConsistencyLevelEnum; // consistency level
  ignore_growing?: boolean; // ignore growing
  group_by_field?: string; // group by field
  group_size?: number; // group size
  strict_group_size?: boolean; // if strict group size
  hints?: string; // hints to improve milvus search performance
  round_decimal?: number; // round decimal
  transformers?: OutputTransformers; // provide custom data transformer for specific data type like bf16 or f16 vectors
  rerank?: RerankerObj | FunctionObject; // reranker
}

export type HybridSearchSingleReq = Pick<
  SearchParam,
  'anns_field' | 'ignore_growing' | 'group_by_field'
> & {
  data: SearchDataType; // vector to search
  expr?: string; // filter expression
  exprValues?: keyValueObj; // template values for filter expression, eg: {key: 'value'}
  params?: keyValueObj; // extra search parameters
  transformers?: OutputTransformers; // provide custom data transformer for specific data type like bf16 or f16 vectors
};

export interface SearchIteratorReq
  extends Omit<SearchSimpleReq, 'vectors' | 'offset' | 'limit' | 'topk'> {
  limit?: number; // Optional. Specifies the maximum number of items. Default is no limit (-1 or if not set).
  batchSize: number; // Specifies the number of items to return in each batch. if it exceeds 16384, it will be set to 16384
  external_filter_fn?: (row: SearchResultData) => boolean; // Optional. Specifies the external filter function.
}

// rerank strategy and parameters
export type RerankerObj = {
  strategy: RANKER_TYPE | string; // rerank strategy
  params: keyValueObj; // rerank parameters
};

// hybrid search api parameter type
export type HybridSearchReq = Omit<
  SearchSimpleReq,
  | 'data'
  | 'vector'
  | 'vectors'
  | 'params'
  | 'anns_field'
  | 'expr'
  | 'exprValues'
> & {
  // search requests
  data: HybridSearchSingleReq[];

  params?: keyValueObj; //  search parameters

  rerank?: RerankerObj | FunctionObject; // reranker
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
    recalls: number[];
    search_iterator_v2_results?: Record<string, any>;
    _search_iterator_v2_results?: string;
    all_search_count?: number;
  };
  collection_name: string;
  session_ts: number;
}

// because in javascript, there is no float16 and bfloat16 type
// we need to provide custom data transformer for these types
export type OutputTransformers = {
  [DataType.BFloat16Vector]?: (bf16bytes: Uint8Array) => BFloat16Vector;
  [DataType.Float16Vector]?: (f16: Uint8Array) => Float16Vector;
  [DataType.SparseFloatVector]?: (sparse: SparseVectorDic) => SparseFloatVector;
  [DataType.Int8Vector]?: (int8Vector: Int8Array) => Int8Vector;
};

export type DetermineResultsType<T extends Record<string, any>> =
  T['vectors'] extends [VectorTypes]
    ? SearchResultData[]
    : T['vectors'] extends VectorTypes[]
    ? SearchResultData[][]
    : T['vector'] extends VectorTypes
    ? SearchResultData[]
    : T['data'] extends [any]
    ? SearchResultData[]
    : T['data'] extends VectorTypes[] | string[]
    ? SearchResultData[][]
    : SearchResultData[];

export interface SearchResultData {
  [x: string]: any;
  score: number;
  id: string;
}

export interface SearchResults<
  T extends SearchReq | SearchSimpleReq | HybridSearchReq
> extends resStatusResponse {
  results: DetermineResultsType<T>;
  recalls: number[];
  session_ts: number;
  collection_name: string;
  all_search_count?: number;
  search_iterator_v2_results?: Record<string, any>;
  _search_iterator_v2_results?: string;
}
