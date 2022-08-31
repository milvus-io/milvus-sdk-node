import { GrpcTimeOut } from './Common';

export interface CreateIndexParam {
  index_type: string;
  metric_type: string;
  params: string;
}
export interface CreateIndexReq extends GrpcTimeOut {
  collection_name: string;
  field_name: string;
  index_name?: string;
  extra_params?: CreateIndexParam;
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
