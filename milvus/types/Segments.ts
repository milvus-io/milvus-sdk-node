import { SegmentState, SegmentLevel } from '../const';
import { resStatusResponse, collectionNameReq, GrpcTimeOut } from './Common';

export interface GetFlushStateReq extends GrpcTimeOut {
  segmentIDs?: number[]; // segment id array
  flush_ts?: number; // flush timestamp
  db_name?: string; // database name
  collection_name?: string; // collection name
}

export interface FlushReq extends GrpcTimeOut {
  collection_names: string[]; // collection names
  db_name?: string; // database name
}

export interface FlushResult extends resStatusResponse {
  coll_segIDs: any; // collection segment id array
}

export interface GetFlushStateResponse extends resStatusResponse {
  flushed: boolean;
}

export interface QuerySegmentInfo {
  segmentID: number;
  collectionID: number;
  partitionID: number;
  mem_size: number;
  num_rows: number;
  index_name: string;
  indexID: number;
  nodeID: number; // deprecated, use nodeIds instead
  state: SegmentState;
  nodeIds: number[];
  level: SegmentLevel;
  is_sorted: boolean;
  storage_version: number;
}

export interface GetQuerySegmentInfoResponse extends resStatusResponse {
  infos: QuerySegmentInfo[];
}

export interface PersistentSegmentInfo {
  segmentID: number;
  collectionID: number;
  partitionID: number;
  num_rows: number;
  state: SegmentState;
  level: SegmentLevel;
  is_sorted: boolean;
  storage_version: number;
}

export interface GePersistentSegmentInfoResponse extends resStatusResponse {
  infos: PersistentSegmentInfo[];
}

export interface ListIndexedSegmentReq extends collectionNameReq {
  index_name: string; // index name
}

export interface ListIndexedSegmentResponse extends resStatusResponse {
  segmentIDs: number[]; // indexed segment id array
}

export interface DescribeSegmentIndexDataReq extends collectionNameReq {
  index_name: string; // index name
  segmentsIDs: number[]; // segment id array
}

export interface DescribeSegmentIndexDataResponse extends resStatusResponse {
  index_params: any; // index parameters
  index_data: any; // index data
}

export interface FlushAllReq extends GrpcTimeOut {
  db_name?: string; // database name (deprecated)
}

export interface FlushClusterInfo {
  cluster_id: string;
  cchannel: string;
  pchannels: string[];
}

export interface FlushAllResponse extends resStatusResponse {
  flush_all_ts: number; // flush all timestamp (deprecated)
  flush_all_tss: Record<string, number>; // flush all timestamps
  flush_all_msgs: Record<string, any>; // pchannel -> FlushAllMsg
  cluster_info: FlushClusterInfo; // cluster info
}

export interface GetFlushAllStateReq extends GrpcTimeOut {
  flush_all_ts?: number; // flush all timestamp (deprecated)
  db_name?: string; // database name (deprecated)
  flush_all_tss?: Record<string, number>; // flush all timestamps
}

export interface GetFlushAllStateResponse extends resStatusResponse {
  flushed: boolean;
}

export interface GetQuerySegmentInfoReq extends GrpcTimeOut {
  collectionName: string; // its collectioName, this is not colleciton_name :<
  dbName?: string; // database name
}

export interface GePersistentSegmentInfoReq extends GrpcTimeOut {
  collectionName: string; // its collectioName, this is not colleciton_name:<
  dbName?: string; // database name
}

export interface LoadBalanceReq extends GrpcTimeOut {
  src_nodeID: number; // The source query node id to balance.
  dst_nodeIDs?: number[]; // The destination query node ids to balance.
  sealed_segmentIDs?: number[]; // Sealed segment ids to balance.
  collectionName?: string; // The collection to balance.
  db_name?: string; // The database name.
}
