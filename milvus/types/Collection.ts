import { DataType, KeyValuePair, MsgType } from "./Common";
export interface MsgBase {
  base?: {
    msg_type: MsgType; // required
  };
}

export interface FieldType {
  name: string;
  description: string;
  data_type?: DataType;
  is_primary_key?: boolean;
  type_params?: KeyValuePair[];
}

export interface CreateCollectionReq {
  // collection name
  collection_name: string;
  shards_num?: number; // int
  autoID?: boolean;
  description?: string;
  fields: FieldType[];
}

export interface HasCollectionReq {
  collection_name: string;
}

export interface DescribeCollectionReq {
  collection_name: string;
}

export interface GetCollectionStatisticsReq {
  collection_name: string;
}

export interface LoadCollectionReq {
  collection_name: string;
}

export interface ReleaseLoadCollectionReq {
  collection_name: string;
}

export interface DropCollectionReq {
  collection_name: string;
}
