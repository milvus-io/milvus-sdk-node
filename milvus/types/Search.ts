import { DslType, KeyValuePair } from "./Common";

export interface SearchReq {
  collection_name: string;
  partition_names: string[];
  dsl: string;
  dsl_type: DslType;
  search_params: KeyValuePair[];
  placeholder_group: number[][];
}
