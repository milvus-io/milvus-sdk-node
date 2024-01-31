import {
  ResStatus,
  KeyValuePair,
  GrpcTimeOut,
  TimeStamp,
  TimeStampArray,
  resStatusResponse,
  collectionNameReq,
} from './Common';
import {
  CompactionState,
  DataType,
  LoadState,
  DataTypeMap,
  ShowCollectionsType,
} from '../';

// returned from milvus
export interface FieldSchema {
  type_params: KeyValuePair[];
  index_params: KeyValuePair[];
  fieldID: string | number;
  name: string;
  is_primary_key?: boolean;
  description: string;
  data_type: keyof typeof DataType;
  autoID: boolean;
  state: string;
  element_type?: keyof typeof DataType;
  default_value?: number | string;
  dataType?: DataType;
  is_partition_key?: boolean;
  is_dynamic?: boolean;
  is_clustering_key?: boolean;
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
export type TypeParamKey = 'dim' | 'max_length' | 'max_capacity';

// create collection
export interface FieldType {
  name: string;
  description?: string;
  data_type: DataType | keyof typeof DataTypeMap;
  element_type?: DataType | keyof typeof DataTypeMap;
  is_primary_key?: boolean;
  is_partition_key?: boolean;
  type_params?: {
    [key: string]: TypeParam;
  };
  autoID?: boolean;
  dim?: TypeParam;
  max_capacity?: TypeParam;
  max_length?: TypeParam;
  default_value?: number | string;
}

export interface ShowCollectionsReq extends GrpcTimeOut {
  type?: ShowCollectionsType;
  collection_names?: string[];
}

export interface BaseCreateCollectionReq extends GrpcTimeOut {
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
  num_partitions?: number;
  partition_key_field?: string;
  enable_dynamic_field?: boolean;
  enableDynamicField?: boolean;
}

export interface CreateCollectionWithFieldsReq extends BaseCreateCollectionReq {
  fields: FieldType[];
}

export interface CreateCollectionWithSchemaReq extends BaseCreateCollectionReq {
  schema: FieldType[];
}

export type CreateCollectionReq =
  | CreateCollectionWithFieldsReq
  | CreateCollectionWithSchemaReq;

export interface HasCollectionReq extends collectionNameReq {}

export interface DescribeCollectionReq extends collectionNameReq {
  cache?: boolean;
}

export interface GetCollectionStatisticsReq extends collectionNameReq {}

export interface LoadCollectionReq extends collectionNameReq {
  replica_number?: number;
  resource_groups?: string[];
  refresh?: boolean;
}
export interface ReleaseLoadCollectionReq extends collectionNameReq {}

export interface DropCollectionReq extends collectionNameReq {}

// alias type
export interface CreateAliasReq extends collectionNameReq {
  alias: string;
}
export interface DescribeAliasReq extends CreateAliasReq {
  alias: string;
}
export interface DropAliasReq extends GrpcTimeOut {
  alias: string;
}
export interface AlterAliasReq extends CreateAliasReq {}
export interface ListAliasesReq extends collectionNameReq {}

export interface CompactReq extends collectionNameReq {
  timetravel?: number | string;
}

export interface GetCompactionStateReq extends GrpcTimeOut {
  compactionID: number | string;
}

export interface GetCompactionPlansReq extends GrpcTimeOut {
  compactionID: number | string;
}

export interface GetReplicaReq extends GrpcTimeOut {
  collectionID: number | string;
  with_shard_nodes?: boolean;
}

export interface RenameCollectionReq extends collectionNameReq {
  new_collection_name: string;
}

export interface BoolResponse extends resStatusResponse {
  value: Boolean;
}
export interface CompactionResponse extends resStatusResponse {
  compactionID: string;
}

// type returned from milvus describe
export interface CollectionSchema {
  name: string;
  description: string;
  enable_dynamic_field: boolean;
  autoID: boolean;
  fields: FieldSchema[];
}

export interface DescribeCollectionResponse extends TimeStamp {
  status: ResStatus;
  schema: CollectionSchema;
  collectionID: string;
  consistency_level: string;
  aliases: string[];
  virtual_channel_names: string[]; // not useful for now
  physical_channel_names: string[]; // not useful for now
  start_positions: string[];
  properties: KeyValuePair[];
  created_timestamp: string;
  created_utc_timestamp: string;
  shards_num: number;
  num_partitions?: string; // int64
  db_name: string;
}

export interface GetCompactionPlansResponse extends resStatusResponse {
  state: CompactionState;
  mergeInfos: { sources: string[]; target: string }[];
}

export interface GetCompactionStateResponse extends resStatusResponse {
  state: CompactionState;
  executingPlanNo: string;
  timeoutPlanNo: string;
  completedPlanNo: string;
}

export interface ShowCollectionsResponse extends TimeStampArray {
  status: ResStatus;
  data: CollectionData[];
}

export interface StatisticsResponse extends resStatusResponse {
  stats: KeyValuePair[];
  data: { [x: string]: any };
}

export interface ReplicasResponse extends resStatusResponse {
  replicas: ReplicaInfo[];
}

export interface GetLoadingProgressReq extends GrpcTimeOut {
  collection_name: string;
  partition_names?: string[];
}
export interface GetLoadingProgressResponse extends resStatusResponse {
  progress: string;
}

export interface GetLoadStateReq extends GetLoadingProgressReq {}
export interface GetLoadStateResponse extends resStatusResponse {
  state: LoadState;
}

export interface AlterCollectionReq extends collectionNameReq {
  properties: Record<string, string | number | boolean>;
}

export interface DescribeAliasResponse extends resStatusResponse {
  db_name: string;
  alias: string;
  collection: string;
}

export interface ListAliasesResponse extends resStatusResponse {
  db_name: string;
  aliases: string[];
  collection_name: string;
}
