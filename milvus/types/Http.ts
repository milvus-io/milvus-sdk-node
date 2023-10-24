import { FloatVectors } from '..';
// Class types
export type Constructor<T = {}> = new (...args: any[]) => T;

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
// http base response
export interface HttpBaseResponse<T = {}> {
  code: number;
  data: T;
  message?: string;
}

// collection operations
export interface HttpCollectionCreateReq extends HttpBaseReq {
  dimension: number;
  metricType: string;
  primaryField: string;
  vectorField: string;
  description?: string;
}
// list collection request
export interface HttpCollectionListReq
  extends Omit<HttpBaseReq, 'collectionName'> {}

type Field = {
  autoId?: boolean;
  description: string;
  primaryKey?: boolean;
  type: string;
};

type Index = {
  fieldName: string;
  indexName: string;
  metricType: string;
};

// describe collection response
export interface HttpCollectionDescribeResponse
  extends HttpBaseResponse<{
    collectionName: string;
    description: string;
    fields: Field[];
    indexes: Index[];
    load: string;
    shardsNum: number;
    enableDynamic: boolean;
  }> {}

// list collections response
export interface HttpCollectionListResponse
  extends HttpBaseResponse<string[]> {}

// vector operations
// insert data request
export interface HttpVectorInsertReq extends HttpBaseReq {
  data: Record<string, any>[];
}

// insert data response
export interface HttpVectorInsertResponse
  extends HttpBaseResponse<{
    insertCount: number;
    insertIds: number | string[];
  }> {}

// get vector request
export interface HttpVectorGetReq extends HttpBaseReq {
  id: number | number[] | string | string[];
  outputFields: string[];
}

// delete vector request
export interface HttpVectorDeleteReq
  extends Omit<HttpVectorGetReq, 'outputFields'> {}

// query data request
export interface HttpVectorQueryReq extends HttpBaseReq {
  outputFields: string[];
  filter?: string;
  limit?: number;
  offset?: number;
  params?: Record<string, string | number>;
}

type QueryResult = Record<string, any>[];

// query response
export interface HttpVectorQueryResponse
  extends HttpBaseResponse<QueryResult> {}

// search request
export interface HttpVectorSearchReq
  extends Omit<HttpVectorQueryReq, 'filter'> {
  vector: FloatVectors;
  filter?: string;
}

export interface HttpVectorSearchResponse extends HttpVectorQueryResponse {
  data: QueryResult & { distance: number | string };
}
