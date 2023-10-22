import { FloatVectors } from '..';

type HttpClientConfigBase = {
  // database name
  database?: string;
  // version
  version?: string;
  // token
  token?: string;
  // The username to use for authentication.
  username?: string;
  // The password to use for authentication.
  password?: string;
  // request timeout, number in milliseconds.
  timeout?: number;
};

type HttpClientConfigAddress = HttpClientConfigBase & {
  // The address in the format of ${MILVUS_HOST}:${MILVUS_PORT}, for example: 127.0.0.1:19530. It is used to build the baseURL for the HTTP client.
  address: string;
  baseURL?: string;
};

type HttpClientConfigBaseURL = HttpClientConfigBase & {
  address?: string;
  // The baseURL is the endpoint's base URL. It is in the format https://${MILVUS_HOST}:${MILVUS_PORT}/v1/. If baseURL is set, it will override the address property.
  baseURL: string;
};

export type HttpClientConfig =
  | HttpClientConfigAddress
  | HttpClientConfigBaseURL;

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
