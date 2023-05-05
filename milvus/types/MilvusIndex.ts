import {
  GrpcTimeOut,
  ResStatus,
  KeyValuePair,
  IndexState,
  keyValueObj,
} from '..';

export interface CreateIndexParam {
  index_type: string;
  metric_type: string;
  params?: string;
}
export interface CreateIndexReq extends GrpcTimeOut {
  collection_name: string;
  field_name: string;
  index_name?: string;
  extra_params?: CreateIndexParam;
}

export interface CreateIndexSimpleReq extends GrpcTimeOut {
  collection_name: string;
  field_name: string;
  index_name?: string;
  index_type: string;
  metric_type: string;
  params?: keyValueObj;
}

export interface DescribeIndexReq extends GrpcTimeOut {
  collection_name: string;
  field_name?: string;
  index_name?: string;
}

export interface GetIndexStateReq extends GrpcTimeOut {
  collection_name: string;
  field_name?: string;
  index_name?: string;
}

export interface GetIndexBuildProgressReq extends GrpcTimeOut {
  collection_name: string;
  field_name?: string;
  index_name?: string;
}

export interface DropIndexReq extends GrpcTimeOut {
  collection_name: string;
  field_name: string;
  index_name?: string;
}

export interface IndexDescription {
  index_name: string;
  indexID: number;
  params: KeyValuePair[];
  field_name: string;
}
export interface DescribeIndexResponse {
  status: ResStatus;
  index_descriptions: IndexDescription[];
}

export interface GetIndexStateResponse {
  status: ResStatus;
  state: IndexState;
}

export interface GetIndexBuildProgressResponse {
  status: ResStatus;
  indexed_rows: number;
  total_rows: number;
}
