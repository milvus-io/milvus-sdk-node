import { FloatVector } from '..';
import type {
  ExportSnapshotState,
  Properties,
  RefreshExternalCollectionState,
  RestoreSnapshotState,
} from './Collection';
import type { FieldPartialUpdateOpName } from './Insert';
import type { KeyValuePair } from './Common';
type Fetch = (input: any, init?: any) => Promise<any>;

// Class types
export type Constructor<T = {}> = new (...args: any[]) => T;
export type FetchOptions = {
  abortController: AbortController;
  timeout: number;
};

type HttpClientConfigBase = {
  // database name
  database?: string;
  // token
  token?: string;
  // The username to use for authentication.
  username?: string;
  // The password to use for authentication.
  password?: string;
  // request timeout, number in milliseconds.
  timeout?: number;
  // altenative fetch api
  fetch?: Fetch;
  // accept int64
  acceptInt64?: boolean;
};

type HttpClientConfigAddress = HttpClientConfigBase & {
  // The address in the format of ${MILVUS_HOST}:${MILVUS_PORT}, for example: 127.0.0.1:19530. It is used to build the baseURL for the HTTP client.
  endpoint: string;
  baseURL?: string;
};

type HttpClientConfigBaseURL = HttpClientConfigBase & {
  endpoint?: string;
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
type CollectionIndexParam = {
  metricType: string;
  fieldName: string;
  indexName: string;
  params?: {
    index_type: string; // The type of the index to create
    nlist?: number; // The number of cluster units. This applies to IVF-related index types.
    M?: string; // The maximum degree of the node and applies only when index_type is set to __HNSW__.
    efConstruction?: string; // The search scope. This applies only when **index_type** is set to **HNSW**
  };
};

type CollectionCreateParams = {
  max_length?: number; // The maximum number of characters in a VarChar field. This parameter is mandatory when the current field type is VarChar.
  enableDynamicField?: boolean; // Whether to enable the reserved dynamic field. If set to true, non-schema-defined fields are saved in the reserved dynamic field as key-value pairs.
  shardsNum?: number; // The number of shards to create along with the current collection.
  consistencyLevel?: string; // The consistency level of the collection. Possible values are __STRONG__, __BOUNDED__, __SESSION__, and __EVENTUALLY__.
  partitionsNum?: number; // The number of partitions to create along with the current collection. This parameter is mandatory if one field of the collection has been designated as the partition key.
  ttlSeconds?: number; // The time-to-live (TTL) period of the collection. If set, the collection is to be dropped once the period ends.
};

type CollectionCreateField = {
  fieldName: string; // The name of the field to create in the target collection
  dataType: string; // The data type of the field values.
  elementDataType?: string; // The data type of the elements in an array field.
  isPrimary?: boolean; // Whether the current field is the primary field. Setting this to True makes the current field the primary field.
  isPartitionKey?: boolean; // Whether the current field serves as the partition key. Setting this to True makes the current field serve as the partition key. In this case, MilvusZilliz Cloud manages all partitions in the current collection.
  elementTypeParams?: {
    max_length?: number; // An optional parameter for VarChar values that determines the maximum length of the value in the current field.
    dim?: number; // An optional parameter for FloatVector or BinaryVector fields that determines the vector dimension.
    max_capacity?: number; // An optional parameter for Array field values that determines the maximum number of elements in the current array field.
  };
};

type CollectionCreateSchema = {
  autoID?: boolean;
  enabledDynamicField?: boolean;
  fields: CollectionCreateField[];
};

export interface HttpCollectionCreateReq extends HttpBaseReq {
  dimension?: number; // The number of dimensions a vector value should have.This is required if **dtype** of this field is set to **DataType.FLOAT_VECTOR**.
  metricType?: string; // The metric type applied to this operation. Possible values are **L2**, **IP**, and **COSINE**.
  idType?: string; // The data type of the primary field. This parameter is designed for the quick-setup of a collection and will be ignored if __schema__ is defined.
  autoID?: boolean; // Whether the primary field automatically increments. This parameter is designed for the quick-setup of a collection and will be ignored if __schema__ is defined.
  primaryFieldName?: string; // The name of the primary field. This parameter is designed for the quick-setup of a collection and will be ignored if __schema__ is defined.
  vectorFieldName?: string; // The name of the vector field. This parameter is designed for the quick-setup of a collection and will be ignored if __schema__ is defined.
  schema?: CollectionCreateSchema; // The schema is responsible for organizing data in the target collection. A valid schema should have multiple fields, which must include a primary key, a vector field, and several scalar fields.
  indexParams?: CollectionIndexParam[]; // The parameters that apply to the index-building process.
  params?: CollectionCreateParams; // Extra parameters for the collection.
}

export interface HttpCollectionTypeSchema {
  leafType?: string;
  arrayElement?: HttpCollectionTypeSchema;
  typeParams?: Record<string, unknown>;
  nullable?: boolean;
}

export interface HttpCollectionFieldSchema {
  fieldName: string; // The name of the field to create in the target collection
  dataType: string; // The data type of the field values.
  description?: string;
  elementDataType?: string; // The data type of the elements in an array field.
  elementNullable?: boolean;
  typeSchema?: HttpCollectionTypeSchema;
  fields?: HttpCollectionFieldSchema[];
  nullable?: boolean; // Whether the field can be null.
  defaultValue?: string | number | boolean | null; // The default value of the field.
  isPrimary?: boolean; // Whether the current field is the primary field.
  isPartitionKey?: boolean; // Whether the current field serves as the partition key.
  isClusteringKey?: boolean;
  externalField?: string;
  typeParams?: Record<string, unknown>;
  elementTypeParams?: {
    max_length?: number; // Optional VarChar max length.
    dim?: number; // Optional vector dimension.
    max_capacity?: number; // Optional array max capacity.
    [key: string]: unknown;
  };
}

export interface HttpCollectionAddFieldReq extends HttpBaseReq {
  schema: HttpCollectionFieldSchema;
}

export interface HttpCollectionAddFieldResponse extends HttpBaseResponse {}

export interface HttpCollectionAddStructFieldReq extends HttpBaseReq {
  schema: HttpCollectionFieldSchema & {
    fields: HttpCollectionFieldSchema[];
  } & (
      | { dataType: 'ArrayOfStruct' }
      | { dataType: 'Array'; elementDataType: 'Struct' }
    );
}

export type HttpCollectionDropFieldReq = HttpBaseReq &
  (
    | { fieldName: string; fieldId?: never }
    | { fieldName?: never; fieldId: number }
  );

export interface HttpCollectionFunction {
  name: string;
  type: string;
  description?: string;
  inputFieldNames: string[];
  outputFieldNames: string[];
  params?: Record<string, unknown>;
}

export interface HttpCollectionFunctionReq extends HttpBaseReq {
  functionName: string;
}

export interface HttpCollectionAlterFunctionReq
  extends HttpCollectionFunctionReq {
  function: HttpCollectionFunction;
}

export interface HttpCollectionAddFunctionFieldReq extends HttpBaseReq {
  function: HttpCollectionFunction;
  outputField: HttpCollectionFieldSchema;
  indexParams?: {
    fieldName: string;
    indexName?: string;
    metricType?: string;
    indexType?: string;
    params?: Record<string, unknown>;
  };
}

type CollectionProperties = Record<string, string | number | boolean>;

export interface HttpCollectionAlterPropertiesReq extends HttpBaseReq {
  properties: CollectionProperties;
}

export interface HttpCollectionAlterPropertiesResponse extends HttpBaseResponse {}

type CollectionFieldParams = {
  max_length?: number;
  max_capacity?: number;
  mmap_enabled?: boolean;
};

export interface HttpCollectionAlterFieldPropertiesReq extends HttpBaseReq {
  fieldName: string;
  fieldParams: CollectionFieldParams;
}

export interface HttpCollectionAlterFieldPropertiesResponse
  extends HttpBaseResponse {}

export interface HttpCollectionDropPropertiesReq extends HttpBaseReq {
  propertyKeys: string[];
}

export interface HttpCollectionDropPropertiesResponse extends HttpBaseResponse {}

export interface HttpDatabaseCreateReq {
  dbName: string;
  properties?: Properties;
}

export interface HttpDatabaseDropReq {
  dbName: string;
}

export interface HttpDatabaseDescribeReq {
  dbName: string;
}

export interface HttpDatabaseDescribeResponse
  extends HttpBaseResponse<{
    dbName: string;
    dbId: number;
    createdTime: string;
    properties: Record<string, string | number | boolean>[];
  }> {}

export interface HttpDatabaseAlterPropertiesReq {
  dbName: string;
  properties: Record<string, string | number | boolean>;
}

export interface HttpDatabaseAlterPropertiesResponse extends HttpBaseResponse {}

export interface HttpDatabaseDropPropertiesReq {
  dbName: string;
  propertyKeys: string[];
}

export interface HttpDatabaseDropPropertiesResponse extends HttpBaseResponse {}
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
    enableDynamicField: boolean;
  }> {}

// list collections response
export interface HttpCollectionListResponse
  extends HttpBaseResponse<string[]> {}

export interface HttpCollectionHasResponse
  extends HttpBaseResponse<{ has: boolean }> {}

export interface HttpCollectionRenameReq extends HttpBaseReq {
  newCollectionName: string;
  newDbName?: string;
}

export interface HttpCollectionStatisticsResponse
  extends HttpBaseResponse<{ rowCount: number }> {}

export interface HttpCollectionFlushResponse extends HttpBaseResponse {}

export interface HttpCollectionCompactReq extends HttpBaseReq {}

export interface HttpCollectionCompactResponse
  extends HttpBaseResponse<{ compactionID: number }> {}

export interface HttpCollectionGetCompactionStateReq extends HttpBaseReq {
  compactionID: number;
}

export interface HttpCollectionGetCompactionStateResponse
  extends HttpBaseResponse<{
    state: number;
    executingPlan: number;
    timeoutPlan: number;
    completedPlan: number;
  }> {}

export interface HttpCollectionRefreshLoadReq extends HttpBaseReq {}

export interface HttpCollectionLoadStateReq extends HttpBaseReq {
  partitionNames?: string;
}

export interface HttpCollectionLoadStateResponse
  extends HttpBaseResponse<{ loadProgress: number; loadState: string }> {}

// vector operations
// insert data request
export interface HttpVectorInsertReq extends HttpBaseReq {
  data: Record<string, any>[];
}

export interface HttpVectorUpsertReq extends HttpVectorInsertReq {
  partitionName?: string;
  partialUpdate?: boolean;
  fieldOps?: {
    fieldName: string;
    op: FieldPartialUpdateOpName;
    /** Required for PATH_REPLACE (Milvus 3.0.6+). */
    path?: string;
  }[];
}

// insert data response
export interface HttpVectorInsertResponse
  extends HttpBaseResponse<{
    insertCount: number;
    insertIds: number | string[];
  }> {}

// upsert data response
export interface HttpVectorUpsertResponse
  extends HttpBaseResponse<{
    upsertCount: number;
    upsertIds: number | string[];
  }> {}

// get vector request
export interface HttpVectorGetReq extends HttpBaseReq {
  id: number | number[] | string | string[];
  outputFields: string[];
}

// delete vector request
export interface HttpVectorDeleteReq extends HttpBaseReq {
  filter: string;
  partitionName?: string;
}

// query data request
export interface HttpVectorQueryReq extends HttpBaseReq {
  outputFields: string[];
  filter?: string;
  limit?: number;
  offset?: number;
  partitionNames?: string[];
  consistencyLevel?: string;
}

type QueryResult = Record<string, any>[];

// query response
export interface HttpVectorQueryResponse
  extends HttpBaseResponse<QueryResult> {}

// search request
export interface HttpVectorSearchReq extends HttpVectorQueryReq {
  data: FloatVector[];
  annsField?: string;
  groupingField?: string;
  searchParams?: Record<string, any>;
}

// hybrid search request
interface HttpVectorHybridSearchParams {
  data: FloatVector[];
  limit: number;
  filter?: string;
  outputFields?: string[];
  offset?: number;
  annsField?: string;
  ignoreGrowing?: boolean;
  metricType?: string;
  params?: Record<string, string | number>;
}

export interface HttpVectorHybridSearchReq extends HttpBaseReq {
  search: HttpVectorHybridSearchParams[];
  rerank: Record<string, any>;
  partitionNames?: string[];
  outputFields?: string[];
  limit?: number;
}

type QueryResultWithDistance = {
  distance: number | string;
} & QueryResult;

export interface HttpVectorSearchResponse extends HttpVectorQueryResponse {
  data: QueryResultWithDistance | QueryResultWithDistance[];
  topks: number[];
}

/* partition operation */
export interface HttpPartitionBaseReq extends HttpBaseReq {
  partitionName: string;
}

export interface HttpPartitionListReq extends HttpBaseReq {
  partitionNames: string[];
}

export interface HttpPartitionHasResponse
  extends HttpBaseResponse<{ has: boolean }> {}

export interface HttpPartitionStatisticsResponse
  extends HttpBaseResponse<{ rowCount: number }> {}

/* user operation */
export interface HttpUserBaseReq {
  userName: string;
}

export interface HttpUserCreateReq extends HttpUserBaseReq {
  password: string;
}

export interface HttpUserUpdatePasswordReq extends HttpUserCreateReq {
  newPassword: string;
}

export interface HttpUserRoleReq extends HttpUserBaseReq {
  roleName: string;
}

/* role operation */
export interface HttpRoleBaseReq {
  roleName: string;
}

export interface HttpCreateRoleReq extends HttpRoleBaseReq {
  description?: string;
}

export interface HttpAlterRoleReq extends HttpRoleBaseReq {
  description: string;
}

export interface HttpDescribeRoleReq extends HttpRoleBaseReq {
  dbName?: string;
}

export interface HttpRolePrivilegeV2Req extends HttpDescribeRoleReq {
  collectionName: string;
  privilege: string;
}

export interface HttpPrivilegeGroupReq {
  privilegeGroupName: string;
}

export interface HttpOperatePrivilegeGroupReq extends HttpPrivilegeGroupReq {
  privileges: string[];
}

export interface HttpPrivilegeGroupInfo extends HttpPrivilegeGroupReq {
  /** Comma-separated privilege names returned by Milvus. */
  privileges: string;
}

export interface HttpRolePrivilegeReq extends HttpRoleBaseReq {
  objectType: string;
  objectName: string;
  privilege: string;
}

export interface HttpRoleDescribeResponse
  extends HttpBaseResponse<
    (HttpRolePrivilegeReq & { dbName?: string; grantor?: string })[]
  > {
  description?: string;
}

/* index operation */
export interface HttpIndexCreateReq extends HttpBaseReq {
  indexParams: CollectionIndexParam[];
}

export interface HttpIndexBaseReq extends HttpBaseReq {
  indexName: string;
}

export interface HttpIndexAlterPropertiesReq extends HttpIndexBaseReq {
  properties: Record<string, string | number | boolean>;
}

export interface HttpIndexAlterPropertiesResponse extends HttpBaseResponse {}

export interface HttpIndexDropPropertiesReq extends HttpIndexBaseReq {
  propertyKeys: string[];
}

export interface HttpIndexDropPropertiesResponse extends HttpBaseResponse {}

type IndexDescribeType = {
  failReason: string;
  fieldName: string;
  indexName: string;
  indexState: string;
  indexType: string;
  indexedRows: number;
  metricType: string;
  pendingRows: number;
  totalRows: number;
};

export interface HttpIndexDescribeResponse
  extends HttpBaseResponse<IndexDescribeType[]> {}

/* alias operation */
export type HttpAliasBaseReq = Pick<HttpBaseReq, 'dbName'>;

export interface HttpAliasCreateReq extends HttpBaseReq {
  aliasName: string;
}

export type HttpAliasAlterReq = HttpAliasCreateReq;

export interface HttpAliasDescribeReq extends HttpAliasBaseReq {
  aliasName: string;
}

export interface HttpAliasDescribeResponse
  extends HttpBaseResponse<{ aliasName: string } & Required<HttpBaseReq>> {}

export interface HttpAliasDropReq extends Partial<HttpBaseReq> {
  aliasName: string;
}

/* import operation */
type ImportJobType = {
  collectionName: string;
  jobId: string;
  progress: number;
  state: string;
};

type ImportJobDetailType = {
  completeTime: string;
  fileName: string;
  fileSize: number;
  importedRows: number;
  progress: number;
  state: string;
  totalRows: number;
};

export interface HttpImportListResponse
  extends HttpBaseResponse<{ records: ImportJobType[] }> {}

interface HttpImportProjectRegionReq {
  projectId?: string;
  regionId?: string;
}

export interface HttpImportListReq
  extends HttpBaseReq,
    HttpImportProjectRegionReq {}

export interface HttpImportCreateReq
  extends HttpBaseReq,
    HttpImportProjectRegionReq {
  files: string[][];
  partitionName?: string;
  options?: {
    timeout?: string;
    /** Set to 'false' for manual commit. Verified on Milvus 3.0.6. */
    auto_commit?: 'true' | 'false';
    [key: string]: string | undefined;
  };
}

export interface HttpImportCreateResponse
  extends HttpBaseResponse<{
    jobId: string;
  }> {}

export interface HttpImportJobReq
  extends Pick<HttpBaseReq, 'dbName'>,
    HttpImportProjectRegionReq {
  jobId: string;
}

export interface HttpImportProgressReq extends HttpImportJobReq {}

export interface HttpImportProgressResponse
  extends HttpBaseResponse<{
    jobId: string;
    progress: number;
    state: string;
    totalRows?: number;
    importedRows?: number;
    fileSize?: number;
    completeTime?: string;
    collectionName?: string;
    details?: ImportJobDetailType[];
    reason?: string;
  }> {}

export interface HttpSnapshotReq extends HttpBaseReq {
  snapshotName: string;
}

export interface HttpCreateSnapshotReq extends HttpSnapshotReq {
  description?: string;
  compactionProtectionSeconds?: number;
}

export interface HttpSnapshotSummary {
  name: string;
  description: string;
  createTs: string;
  createUtcTs: string;
}

export interface HttpListSnapshotsResponse extends HttpBaseResponse<string[]> {
  snapshotSummaries?: HttpSnapshotSummary[];
}

export interface HttpDescribeSnapshotResponse
  extends HttpBaseResponse<{
    snapshotName: string;
    collectionName: string;
    description: string;
    partitionNames: string[] | null;
    createTs: string;
    s3Location: string;
  }> {}

export interface HttpRestoreSnapshotReq {
  snapshotName: string;
  sourceCollectionName: string;
  targetCollectionName: string;
  sourceDbName?: string;
  targetDbName?: string;
}

export interface HttpExportSnapshotReq extends HttpSnapshotReq {
  targetS3Path: string;
  externalSpec?: string;
}

export interface HttpRestoreExternalSnapshotReq {
  targetCollectionName: string;
  snapshotMetadataURI: string;
  dbName?: string;
  externalSpec?: string;
}

export interface HttpSnapshotJobReq {
  jobId: string;
}

export interface HttpSnapshotJobResponse
  extends HttpBaseResponse<{ jobId: string }> {}

interface HttpSnapshotJobInfo {
  jobId: string;
  snapshotName: string;
  dbName: string;
  collectionName: string;
  progress: number;
  reason: string;
  startTime: string;
  timeCost: string;
}

export interface HttpRestoreSnapshotJobInfo extends HttpSnapshotJobInfo {
  state: keyof typeof RestoreSnapshotState;
}

export interface HttpExportSnapshotJobInfo extends HttpSnapshotJobInfo {
  state: keyof typeof ExportSnapshotState;
  totalFiles: string;
  copiedFiles: string;
  totalBytes: string;
  snapshotMetadataURI: string;
}

export interface HttpPinSnapshotDataReq extends HttpSnapshotReq {
  ttlSeconds?: number;
}

export interface HttpRefreshExternalCollectionReq extends HttpBaseReq {
  externalSource?: string;
  externalSpec?: string;
}

export interface HttpRefreshExternalCollectionJobInfo {
  jobId: string;
  collectionName: string;
  state: keyof typeof RefreshExternalCollectionState;
  progress: number;
  externalSource: string;
  externalSpec: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

export interface HttpResourceGroupReq {
  name: string;
}

export interface HttpResourceGroupConfig {
  requests: { node_num: number };
  limits: { node_num: number };
  transfer_from?: { resource_group: string }[];
  transfer_to?: { resource_group: string }[];
  node_filter?: { node_labels: Record<string, string> };
}

export interface HttpCreateResourceGroupReq extends HttpResourceGroupReq {
  config?: HttpResourceGroupConfig;
}

export interface HttpUpdateResourceGroupsReq {
  resource_groups: Record<string, HttpResourceGroupConfig>;
}

export interface HttpTransferReplicaReq {
  sourceRgName: string;
  targetRgName: string;
  collectionName: string;
  replicaNum: number;
}

export interface HttpResourceGroupInfo {
  name: string;
  capacity?: number;
  num_available_node?: number;
  num_loaded_replica?: Record<string, number>;
  num_outgoing_node?: Record<string, number>;
  num_incoming_node?: Record<string, number>;
  config?: {
    requests?: { node_num?: number };
    limits?: { node_num?: number };
    transfer_from?: { resource_group: string }[];
    transfer_to?: { resource_group: string }[];
    node_filter?: { node_labels?: KeyValuePair[] };
  };
  nodes?: { node_id?: string; address?: string; hostname?: string }[];
}

export interface HttpDescribeResourceGroupResponse {
  resource_group?: HttpResourceGroupInfo;
  code?: number;
  message?: string;
}

export interface HttpFileResourceNameReq {
  name: string;
}

export interface HttpAddFileResourceReq extends HttpFileResourceNameReq {
  /** A path to an object in the Milvus server's storage. */
  path: string;
}

export interface HttpRunAnalyzerReq {
  text: string[];
  /** Analyzer settings or their JSON representation. */
  analyzerParams?: Record<string, unknown> | string;
  withDetail?: boolean;
  withHash?: boolean;
  dbName?: string;
  collectionName?: string;
  fieldName?: string;
  analyzerNames?: string[];
}

export interface HttpAnalyzerToken {
  token: string;
  startOffset?: number;
  endOffset?: number;
  position?: number;
  positionLength?: number;
  hash?: number;
}

export interface HttpRunAnalyzerResult {
  results: { tokens: HttpAnalyzerToken[] }[];
}
