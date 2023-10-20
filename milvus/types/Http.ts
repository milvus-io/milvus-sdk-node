import { FloatVectors } from '..';

export interface HttpClientConfig {
  // The address of the Milvus server.
  address: string;
  // token
  token?: string;
  // The username to use for authentication.
  username?: string;
  // The password to use for authentication.
  password?: string;
}

export interface HttpBaseResponse {
  code: number;
  data: Record<string, any>;
}

// collection create request
export interface HttpCollectionCreate {
  dbName: string;
  collectionName: string;
  dimension: number;
  metricType: string;
  primaryField: string;
  vectorField: string;
}

export interface HttpCollectionDescribeReq {
  collectionName: string;
}

export interface HttpCollectionDropReq {
  collectionName: string;
}

// vectors
export interface HttpVectorGetReq {
  collectionName: string;
  outputFields: string[];
  id: number | number[];
}

export interface HttpVectorDeleteReq {
  collectionName: string;
  id: number | number[];
}

export interface HttpVectorQueryBaseReq {
  collectionName: string;
  outputFields: string[];
  limit?: number;
  offset?: number;
  params?: Record<string, string | number>;
}

export interface HttpVectorQueryReq extends HttpVectorQueryBaseReq {
  filter: string;
}

export interface HttpVectorSearchReq extends HttpVectorQueryBaseReq {
  vector: FloatVectors;
  filter?: string;
}

export interface HttpVectorInsertReq {
  collectionName: string;
  data: Record<string, any>[];
}
