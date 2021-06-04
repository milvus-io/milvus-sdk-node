import { KeyValuePair } from "./common-types";

export interface ResStatus {
  error_code: string;
  reason: string;
}

export interface BoolResponse {
  status: ResStatus;
  value: Boolean;
}

export interface ShowCollectionsResponse {
  status: ResStatus;
  collection_names: string[];
}

export interface FieldSchema {
  name: string;
  description: string;
  is_primary_key?: boolean;
  type_params: KeyValuePair[];
  index_params: KeyValuePair[];
}

export interface CollectionSchema {
  name: string;
  description: string;
  autoID: boolean;
  fields: FieldSchema[];
}

export interface DescribeCollectionResponse {
  status: ResStatus;
  schema: CollectionSchema;
  virtual_channel_names: string[]; // not useful for now
  physical_channel_names: string[]; // not useful for now
}

export interface GetCollectionStatisticsResponse {
  status: ResStatus;
  stats: KeyValuePair[];
}
