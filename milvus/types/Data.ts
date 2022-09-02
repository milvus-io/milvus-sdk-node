import { DataType, GrpcTimeOut } from './Common';

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
  fields_data: { [x: string]: any }[];
  hash_keys?: Number[]; // user can generate hash value depend on primarykey value
}

export interface DeleteEntitiesReq extends GrpcTimeOut {
  collection_name: string;
  expr: string;
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
