import { FloatVectors } from '..';

export interface HttpClientConfig {
  // database name
  database?: string;
  // The address of the Milvus server.
  address: string;
  // alias of address
  url?: string;
  // token
  token?: string;
  // The username to use for authentication.
  username?: string;
  // The password to use for authentication.
  password?: string;
}

// http base request
export interface HttpBaseReq {
  dbName?: string;
  collectionName: string;
}

// collection operations request
export interface HttpCollectionCreateReq extends HttpBaseReq {
  dimension: number;
  metricType: string;
  primaryField: string;
  vectorField: string;
}
export interface HttpCollectionDescribeReq extends HttpBaseReq {}
export interface HttpCollectionDropReq extends HttpBaseReq {}
export interface HttpCollectionListReq extends HttpBaseReq {}

// vector operations request
export interface HttpVectorGetReq extends HttpBaseReq {
  outputFields: string[];
  id: number | number[];
}

export interface HttpVectorDeleteReq extends HttpBaseReq {
  id: number | number[];
}

export interface HttpVectorQueryBaseReq extends HttpBaseReq {
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

export interface HttpVectorInsertReq extends HttpBaseReq {
  collectionName: string;
  data: Record<string, any>[];
}

export interface HttpBaseResponse {
  code: number;
  data: Record<string, any>;
}
