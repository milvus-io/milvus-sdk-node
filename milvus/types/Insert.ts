import { DataType } from "./Common";

export interface FlushReq {
  collection_names: string[];
}
export interface FieldData {
  type: DataType;
  field_name: string;
  dim?: number;
  data: Number[];
}

export interface InsertReq {
  collection_name: string;
  partition_name?: string;
  fields_data: FieldData[];
  hash_keys?: Number[];
  num_rows: Number;
}
