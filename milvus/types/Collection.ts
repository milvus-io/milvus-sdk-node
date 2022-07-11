import { DataType } from './Common';

export interface FieldType {
  name: string;
  description: string;
  data_type?: DataType;
  is_primary_key?: boolean;
  type_params?: {
    dim?: string;
    max_length?: string;
  };
  autoID?: boolean;
}

export enum ShowCollectionsType {
  All,
  Loaded,
}

export interface ShowCollectionsReq {
  type?: ShowCollectionsType;
  collection_names?: string[];
}

export interface CreateCollectionReq {
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

export enum ConsistencyLevelEnum {
  Strong = 0,
  Session = 1, // default in PyMilvus
  Bounded = 2,
  Eventually = 3,
  Customized = 4, // Users pass their own `guarantee_timestamp`.
}

interface CollectionNameReq {
  /**
   * @param collection_name collection name string
   */
  collection_name: string;
}
export interface HasCollectionReq extends CollectionNameReq {}

export interface DescribeCollectionReq extends CollectionNameReq {}

export interface GetCollectionStatisticsReq extends CollectionNameReq {}

export interface LoadCollectionReq extends CollectionNameReq {}
export interface ReleaseLoadCollectionReq extends CollectionNameReq {}

export interface DropCollectionReq extends CollectionNameReq {}

export interface CreateAliasReq extends CollectionNameReq {
  alias: string;
}

export interface DropAliasReq {
  alias: string;
}

export interface AlterAliasReq extends CollectionNameReq {
  alias: string;
}

export interface CompactReq {
  collection_name: string;
  timetravel?: number | string;
}

export interface GetCompactionStateReq {
  compactionID: number | string;
}

export interface GetCompactionPlansReq {
  compactionID: number | string;
}
