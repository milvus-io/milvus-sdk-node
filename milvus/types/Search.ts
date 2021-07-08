import { DslType, KeyValuePair, NumberArrayId, StringArrayId } from "./Common";
import { ResStatus } from "./Response";

// export interface PlaceholderValue {
//   tag:string;
//   type: 0 | 100 | 101;
//   values: []
//   // values is a 2d-array, every array contains a vector
//   repeated bytes values = 3;
// }

export interface SearchReq {
  collection_name: string;
  partition_names?: string[];
  dsl?: string;
  dsl_type: DslType;
  search_params: KeyValuePair[];
  placeholder_group: number[][];
  output_fields?: string[];
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
