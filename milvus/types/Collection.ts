import {
  ResStatus,
  KeyValuePair,
  GrpcTimeOut,
  TimeStamp,
  TimeStampArray,
} from './Common';
import {
  ConsistencyLevelEnum,
  CompactionState,
  DataType,
  LoadState,
} from '../const/Milvus';

export interface FieldSchema {
  name: string;
  description: string;
  data_type: string;
  is_primary_key?: boolean;
  type_params: KeyValuePair[];
  index_params: KeyValuePair[];
  autoID: boolean;
}

export interface CollectionData {
  name: string;
  id: string;
  timestamp: string;
  loadedPercentage: string;
}

export interface ShardReplica {
  leaderID: string;
  leader_addr: string;
  dm_channel_name: string;
  node_ids: string[];
}

export interface ReplicaInfo {
  replicaID: string;
  collectionID: string;
  partition_ids: string[];
  shard_replicas: ShardReplica[];
  node_ids: string[];
}

export type TypeParam = string | number;
export type TypeParamKey = 'dim' | 'max_length';

export interface FieldType {
  name: string;
  description?: string;
  data_type?: DataType;
  is_primary_key?: boolean;
  type_params?: {
    [key: string]: TypeParam;
  };
  autoID?: boolean;
  dim?: TypeParam;
  max_length?: TypeParam;
}

export enum ShowCollectionsType {
  All,
  Loaded,
}

export interface ShowCollectionsReq extends GrpcTimeOut {
  type?: ShowCollectionsType;
  collection_names?: string[];
}

export interface CreateCollectionReq extends GrpcTimeOut {
  // collection name
  collection_name: string;
  shards_num?: number; // int
  description?: string;
  consistency_level?:
    | 'Strong'
    | 'Session'
    | 'Bounded'
    | 'Eventually'
    | 'Customized';
  fields: FieldType[];
}

interface CollectionNameReq extends GrpcTimeOut {
  /**
   * @param collection_name collection name string
   */
  collection_name: string;
}
export interface HasCollectionReq extends CollectionNameReq {}

export interface DescribeCollectionReq extends CollectionNameReq {}

export interface GetCollectionStatisticsReq extends CollectionNameReq {}

export interface LoadCollectionReq extends CollectionNameReq {
  replica_number?: number;
  resource_groups?: string[];
  refresh?: boolean;
}
export interface ReleaseLoadCollectionReq extends CollectionNameReq {}

export interface DropCollectionReq extends CollectionNameReq {}

export interface CreateAliasReq extends CollectionNameReq {
  alias: string;
}

export interface DropAliasReq extends GrpcTimeOut {
  alias: string;
}

export interface AlterAliasReq extends CollectionNameReq {
  alias: string;
}

export interface CompactReq extends GrpcTimeOut {
  collection_name: string;
  timetravel?: number | string;
}

export interface GetCompactionStateReq extends GrpcTimeOut {
  compactionID: number | string;
}

export interface GetCompactionPlansReq extends GrpcTimeOut {
  compactionID: number | string;
}

export interface GetReplicaReq extends GrpcTimeOut {
  /**
   * @param collectionID collection ID
   */
  collectionID: number | string;
  with_shard_nodes?: boolean;
}

export interface RenameCollectionReq extends GrpcTimeOut {
  collection_name: string;
  new_collection_name: string;
}

export interface BoolResponse {
  status: ResStatus;
  value: Boolean;
}
export interface CompactionResponse {
  status: ResStatus;
  compactionID: string;
}

export interface CollectionSchema {
  name: string;
  description: string;
  fields: FieldSchema[];
}

export interface DescribeCollectionResponse extends TimeStamp {
  status: ResStatus;
  schema: CollectionSchema;
  collectionID: string;
  consistency_level: ConsistencyLevelEnum;
  aliases: string[];
  virtual_channel_names: string[]; // not useful for now
  physical_channel_names: string[]; // not useful for now
}

export interface GetCompactionPlansResponse {
  status: ResStatus;
  state: CompactionState;
  mergeInfos: { sources: string[]; target: string }[];
}

export interface GetCompactionStateResponse {
  status: ResStatus;
  state: CompactionState;
  executingPlanNo: string;
  timeoutPlanNo: string;
  completedPlanNo: string;
}

export interface ShowCollectionsResponse extends TimeStampArray {
  status: ResStatus;
  data: CollectionData[];
}

export interface StatisticsResponse {
  status: ResStatus;
  stats: KeyValuePair[];
  data: { [x: string]: any };
}

export interface ReplicasResponse {
  status: ResStatus;
  replicas: ReplicaInfo[];
}

export interface GetLoadingProgressReq extends GrpcTimeOut {
  collection_name: string;
  partition_names?: string[];
}
export interface GetLoadingProgressResponse {
  status: ResStatus;
  progress: string;
}

export interface GetLoadStateReq extends GetLoadingProgressReq {}
export interface GetLoadStateResponse {
  status: ResStatus;
  state: LoadState;
}
