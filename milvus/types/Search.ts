import { DataType } from "./Common";
import { ResStatus } from "./Response";

export interface SearchParam {
  key: "anns_field" | "topk" | "metric_type" | "params";
  value: string;
}

export interface SearchReq {
  collection_name: string;
  partition_names?: string[];
  expr?: string;
  // dsl_type: DslType;
  search_params: SearchParam[];
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
  output_fields: string[];
  partition_names?: string[];
}
