import { DataType } from "./Common";
import { ResStatus } from "./Response";

export interface SearchParam {
  anns_field: string; // your vector field name
  topk: string;
  metric_type: string;
  params: string;
  round_decimal: number;
}
export interface SearchReq {
  collection_name: string;
  partition_names?: string[];
  expr?: string;
  // dsl_type: DslType;
  search_params: SearchParam;
  vectors: number[][];
  output_fields?: string[];
  vector_type: DataType.BinaryVector | DataType.FloatVector;
}

export interface SearchRes {
  status: ResStatus;
  results: {
    top_k: number;
    fields_data: {
      type: string;
      field_name: string;
      field: "scalars";
      scalars: {
        [x: string]: any;
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
      id_field: "int_id" | "str_id";
    };
    num_queries: number;
    topks: number[];
  };
}

export interface QueryReq {
  collection_name: string;
  expr: string;
  output_fields?: string[];
  partition_names?: string[];
}

export interface QueryRes {
  status: ResStatus;
  fields_data: {
    type: DataType;
    field_name: string;
    field: "vectors" | "scalars";
    field_id: number;
    vectors?: {
      dim: string;
      data: "float_vector" | "binary_vector";
      float_vector?: {
        data: number[];
      };
      binary_vector?: {
        data: number[];
      };
    };
    scalars?: {
      // long_data: {data: [stringID]}
      [x: string]: any;
      data: string;
    };
  }[];
}

export interface GetMetricsRequest {
  request: {
    metric_type: "system_info" | "system_statistics" | "system_log";
  };
}
