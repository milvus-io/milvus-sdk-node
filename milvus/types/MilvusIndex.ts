import { KeyValuePair, IndexState, keyValueObj } from '../';
import { resStatusResponse, collectionNameReq } from './Common';

export interface CreateIndexParam {
  index_type?: string; // required, index type, for example: IndexType.HNSSW
  metric_type: string; // required, metric type, for example: MetricType.L2
  params?: string; // optional, index params, for example: { M: 5, efConstruction: 8 }
}
export interface CreateIndexReq extends collectionNameReq {
  field_name: string; // required, field name
  index_name?: string; // optional, index name
  extra_params?: CreateIndexParam; // optional, index params
}

export type CreateIndexRequest = CreateIndexReq | CreateIndexSimpleReq;
export type CreateIndexesReq = CreateIndexRequest[] | CreateIndexRequest;

export interface CreateIndexSimpleReq extends collectionNameReq {
  field_name: string;
  index_type: string;
  metric_type?: string;
  index_name?: string;
  params?: keyValueObj;
}

export interface DescribeIndexReq extends collectionNameReq {
  field_name?: string;
  index_name?: string;
}

export interface FieldNameReq extends collectionNameReq {
  field_name: string;
}

export interface IndexNameReq extends collectionNameReq {
  index_name: string;
}

export interface GetIndexStateReq extends DescribeIndexReq {}
export type GetIndexBuildProgressReq = FieldNameReq | IndexNameReq;
export interface DropIndexReq extends DescribeIndexReq {}

export interface IndexDescription {
  index_name: string;
  indexID: number;
  params: KeyValuePair[];
  field_name: string;
  indexed_rows: string;
  total_rows: string;
  state: string;
  index_state_fail_reason: string;
  pending_index_rows: string;
}
export interface DescribeIndexResponse extends resStatusResponse {
  index_descriptions: IndexDescription[];
}
export interface ListIndexResponse extends resStatusResponse {
  indexes: string[];
}

export interface GetIndexStateResponse extends resStatusResponse {
  state: IndexState;
}

export interface GetIndexBuildProgressResponse extends resStatusResponse {
  indexed_rows: number;
  total_rows: number;
}

export interface AlterIndexReq extends collectionNameReq {
  index_name: string;
  params: Record<string, number | string | boolean>;
}

export interface DropIndexPropertiesReq extends collectionNameReq {
  index_name: string;
  properties: string[];
}
