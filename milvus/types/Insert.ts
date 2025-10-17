import {
  GrpcTimeOut,
  KeyValuePair,
  DataType,
  ImportState,
  collectionNameReq,
  resStatusResponse,
  Bool,
  Int8,
  Int16,
  Int32,
  Int64,
  Float,
  Double,
  VarChar,
  JSON,
  Geometry,
  Array,
  VectorTypes,
  BFloat16Vector,
  Float16Vector,
} from '../';

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
  | Geometry
  | Array
  | VectorTypes
  | null
  | undefined;

// Represents a row of data in Milvus.
export interface RowData {
  [x: string]: FieldData;
}

export interface _Field {
  name: string;
  type: DataType;
  elementType?: DataType;
  data: FieldData[];
  dim?: number;
  nullable?: boolean;
  default_value?: FieldData;
  fieldMap: Map<string, _Field>; // for struct field
}

// because in javascript, there is no float16 and bfloat16 type
// we need to provide custom data transformer for these types
// milvus only accept bytes(buffer) for these types
export type InsertTransformers = {
  [DataType.BFloat16Vector]?: (bf16: BFloat16Vector) => Uint8Array;
  [DataType.Float16Vector]?: (f16: Float16Vector) => Uint8Array;
};

// Base properties shared by both variants
interface BaseInsertReq extends collectionNameReq {
  partition_name?: string; // partition name
  hash_keys?: number[]; // user can generate hash value depend on primarykey value
  transformers?: InsertTransformers; // provide custom data transformer for specific data type like bf16 or f16 vectors
  skip_check_schema?: boolean; // skip schema check
}

// Union type to enforce mutual exclusivity
export type InsertReq = DataInsertReq | FieldsDataInsertReq;
export type UpsertReq = (DataInsertReq | FieldsDataInsertReq) & {
  partial_update?: boolean;
};

// Variant with data property
interface DataInsertReq extends BaseInsertReq {
  data: RowData[]; // data to insert
  fields_data?: never; // Ensure fields_data cannot be used
}

// Variant with fields_data property
interface FieldsDataInsertReq extends BaseInsertReq {
  fields_data: RowData[]; // alias for data
  data?: never; // Ensure data cannot be used
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
