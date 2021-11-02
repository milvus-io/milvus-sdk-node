import { DataType } from "./Common";

export interface FieldType {
  name: string;
  description: string;
  data_type?: DataType;
  is_primary_key?: boolean;
  type_params?: {
    dim: string;
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
  fields: FieldType[];
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
