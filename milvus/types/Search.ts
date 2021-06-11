import { DslType, KeyValuePair } from "./Common";

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
  // todo: proto will change
  placeholder_group: any;
}
