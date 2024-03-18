export enum IndexState {
  IndexStateNone = 0,
  Unissued = 1,
  InProgress = 2,
  Finished = 3,
  Failed = 4,
}

export enum DslType {
  Dsl = 0,
  BoolExprV1 = 1,
}

// consistency levels enum
export enum ConsistencyLevelEnum {
  Strong = 0,
  Session = 1, // default in PyMilvus
  Bounded = 2,
  Eventually = 3,
  Customized = 4, // Users pass their own `guarantee_timestamp`. Deprecated
}

// segement state enum
export enum SegmentState {
  SegmentStateNone,
  NotExist,
  Growing,
  Sealed,
  Flushed = 'Flushed',
  Flushing = 'Flushing',
}

// compaction state enum
export enum CompactionState {
  UndefiedState = 0,
  Executing = 1,
  Completed = 2,
}

// import state enum
export enum ImportState {
  ImportPending = 'ImportPending', // Task is in pending list
  ImportFailed = 'ImportFailed', // Task is failed, use state.infos["failed_reason"] to get the failed reason
  ImportStarted = 'ImportStarted', // Task is dispatched to data node, gonna to be executed.
  ImportPersisted = 'ImportPersisted', // New segments have been generated and persisted.
  ImportCompleted = 'ImportCompleted', // If the collection index has been specified, ImportCompleted indicates the new segments have been indexed successfully. Otherwise,  the task state will be directly converted from ImportPersisted to ImportCompleted.
  ImportFailedAndCleaned = 'ImportFailedAndCleaned', // The task is failed, and the temporary data generated by this task has been cleaned.
}

// RBAC object type
export enum ObjectType {
  Collection = 0,
  Global = 1,
  User = 2,
}

// RBAC object priviledge types
export enum ObjectPrivilege {
  PrivilegeAll = 0,
  PrivilegeCreateCollection = 1,
  PrivilegeDropCollection = 2,
  PrivilegeDescribeCollection = 3,
  PrivilegeShowCollections = 4,
  PrivilegeLoad = 5,
  PrivilegeRelease = 6,
  PrivilegeCompaction = 7,
  PrivilegeInsert = 8,
  PrivilegeDelete = 9,
  PrivilegeGetStatistics = 10,
  PrivilegeCreateIndex = 11,
  PrivilegeIndexDetail = 12,
  PrivilegeDropIndex = 13,
  PrivilegeSearch = 14,
  PrivilegeFlush = 15,
  PrivilegeQuery = 16,
  PrivilegeLoadBalance = 17,
  PrivilegeImport = 18,
  PrivilegeCreateOwnership = 19,
  PrivilegeUpdateUser = 20,
  PrivilegeDropOwnership = 21,
  PrivilegeSelectOwnership = 22,
  PrivilegeManageOwnership = 23,
  PrivilegeSelectUser = 24,
}

// Milvus healthy status code
export enum StateCode {
  Initializing = 0,
  Healthy = 1,
  Abnormal = 2,
  StandBy = 3,
}

// Metric types
export enum MetricType {
  // L2 euclidean distance
  L2 = 'L2',
  // IP inner product
  IP = 'IP',
  // support cosine 2.3
  COSINE = 'COSINE',
  // HAMMING hamming distance
  HAMMING = 'HAMMING',
  // JACCARD jaccard distance
  JACCARD = 'JACCARD',
  // TANIMOTO tanimoto distance
  TANIMOTO = 'TANIMOTO',
  // SUBSTRUCTURE substructure distance
  SUBSTRUCTURE = 'SUBSTRUCTURE',
  // SUPERSTRUCTURE superstructure
  SUPERSTRUCTURE = 'SUPERSTRUCTURE',
}

// Index types
export enum IndexType {
  // vector
  FLAT = 'FLAT',
  IVF_FLAT = 'IVF_FLAT',
  IVF_SQ8 = 'IVF_SQ8',
  IVF_PQ = 'IVF_PQ',
  HNSW = 'HNSW',
  BIN_FLAT = 'BIN_FLAT',
  BIN_IVF_FLAT = 'BIN_IVF_FLAT',
  DISKANN = 'DISKANN',
  AUTOINDEX = 'AUTOINDEX',
  ANNOY = 'ANNOY',
  // 2.3
  GPU_FLAT = 'GPU_FLAT',
  GPU_IVF_FLAT = 'GPU_IVF_FLAT',
  GPU_IVF_PQ = 'GPU_IVF_PQ',
  GPU_IVF_SQ8 = 'GPU_IVF_SQ8',
  GPU_BRUTE_FORCE = 'GPU_BRUTE_FORCE',
  GPU_CAGRA = 'GPU_CAGRA',
  RAFT_IVF_FLAT = 'RAFT_IVF_FLAT',
  RAFT_IVF_PQ = 'RAFT_IVF_PQ',
  ScaNN = 'SCANN',
  // scalar
  STL_SORT = 'STL_SORT',
  TRIE = 'Trie',
  INVERTED = 'INVERTED',
}

// MsgType
export enum MsgType {
  Undefined = 0,
  /* DEFINITION REQUESTS: COLLECTION */
  CreateCollection = 100,
  DropCollection = 101,
  HasCollection = 102,
  DescribeCollection = 103,
  ShowCollections = 104,
  GetSystemConfigs = 105,
  LoadCollection = 106,
  ReleaseCollection = 107,
  CreateAlias = 108,
  DropAlias = 109,
  AlterAlias = 110,
  AlterCollection = 111,

  /* DEFINITION REQUESTS: PARTITION */
  CreatePartition = 200,
  DropPartition = 201,
  HasPartition = 202,
  DescribePartition = 203,
  ShowPartitions = 204,
  LoadPartitions = 205,
  ReleasePartitions = 206,

  /* DEFINE REQUESTS: SEGMENT */
  ShowSegments = 250,
  DescribeSegment = 251,
  LoadSegments = 252,
  ReleaseSegments = 253,
  HandoffSegments = 254,
  LoadBalanceSegments = 255,
  DescribeSegments = 256,

  /* DEFINITION REQUESTS: INDEX */
  CreateIndex = 300,
  DescribeIndex = 301,
  DropIndex = 302,

  /* MANIPULATION REQUESTS */
  Insert = 400,
  Delete = 401,
  Flush = 402,
  ResendSegmentStats = 403,

  /* QUERY */
  Search = 500,
  SearchResult = 501,
  GetIndexState = 502,
  GetIndexBuildProgress = 503,
  GetCollectionStatistics = 504,
  GetPartitionStatistics = 505,
  Retrieve = 506,
  RetrieveResult = 507,
  WatchDmChannels = 508,
  RemoveDmChannels = 509,
  WatchQueryChannels = 510,
  RemoveQueryChannels = 511,
  SealedSegmentsChangeInfo = 512,
  WatchDeltaChannels = 513,
  GetShardLeaders = 514,
  GetReplicas = 515,
  UnsubDmChannel = 516,
  GetDistribution = 517,
  SyncDistribution = 518,

  /* DATA SERVICE */
  SegmentInfo = 600,
  SystemInfo = 601,
  GetRecoveryInfo = 602,
  GetSegmentState = 603,

  /* SYSTEM CONTROL */
  TimeTick = 1200,
  QueryNodeStats = 1201, // GOOSE TODO: Remove kQueryNodeStats
  LoadIndex = 1202,
  RequestID = 1203,
  RequestTSO = 1204,
  AllocateSegment = 1205,
  SegmentStatistics = 1206,
  SegmentFlushDone = 1207,

  DataNodeTt = 1208,

  /* Credential */
  CreateCredential = 1500,
  GetCredential = 1501,
  DeleteCredential = 1502,
  UpdateCredential = 1503,
  ListCredUsernames = 1504,

  /* RBAC */
  CreateRole = 1600,
  DropRole = 1601,
  OperateUserRole = 1602,
  SelectRole = 1603,
  SelectUser = 1604,
  SelectResource = 1605,
  OperatePrivilege = 1606,
  SelectGrant = 1607,
  RefreshPolicyInfoCache = 1608,
  ListPolicy = 1609,
}

// data type enum
export enum DataType {
  None = 0,
  Bool = 1,
  Int8 = 2,
  Int16 = 3,
  Int32 = 4,
  Int64 = 5,

  Float = 10,
  Double = 11,

  // String = 20,
  VarChar = 21, // variable-length strings with a specified maximum length
  Array = 22,
  JSON = 23,

  BinaryVector = 100,
  FloatVector = 101,
}

// data type map
export const DataTypeMap: { [key in keyof typeof DataType]: number } = {
  None: 0,
  Bool: 1,
  Int8: 2,
  Int16: 3,
  Int32: 4,
  Int64: 5,
  Float: 10,
  Double: 11,
  // String: 20,
  VarChar: 21,
  Array: 22,
  JSON: 23,
  BinaryVector: 100,
  FloatVector: 101,
};

// RBAC: operate user role type
export enum OperateUserRoleType {
  AddUserToRole = 0,
  RemoveUserFromRole = 1,
}

// RBAC: operate privilege type
export enum OperatePrivilegeType {
  Grant = 0,
  Revoke = 1,
}

// RBAC: default roles
export enum Roles {
  ADMIN = 'admin',
  PUBLIC = 'public',
}

// RBAC: default objects
export enum RbacObjects {
  Collection = 'Collection',
  Global = 'Global',
  User = 'User',
}

// RBAC: collection privileges
export enum CollectionPrivileges {
  CreateIndex = 'CreateIndex',
  DropIndex = 'DropIndex',
  IndexDetail = 'IndexDetail',
  Load = 'Load',
  GetLoadingProgress = 'GetLoadingProgress',
  GetLoadState = 'GetLoadState',
  Release = 'Release',
  Insert = 'Insert',
  Upsert = 'Upsert',
  Delete = 'Delete',
  Search = 'Search',
  Flush = 'Flush',
  GetFlushState = 'GetFlushState',
  Query = 'Query',
  GetStatistics = 'GetStatistics',
  Compaction = 'Compaction',
  Import = 'Import',
  LoadBalance = 'LoadBalance',
  CreatePartition = 'CreatePartition',
  DropPartition = 'DropPartition',
  ShowPartitions = 'ShowPartitions',
  HasPartition = 'HasPartition',
}

// RBAC: global privileges
export enum GlobalPrivileges {
  All = '*',
  CreateCollection = 'CreateCollection',
  DropCollection = 'DropCollection',
  DescribeCollection = 'DescribeCollection',
  ShowCollections = 'ShowCollections',
  RenameCollection = 'RenameCollection',
  FlushAll = 'FlushAll',
  CreateOwnership = 'CreateOwnership',
  DropOwnership = 'DropOwnership',
  SelectOwnership = 'SelectOwnership',
  ManageOwnership = 'ManageOwnership',
  CreateResourceGroup = 'CreateResourceGroup',
  DropResourceGroup = 'DropResourceGroup',
  DescribeResourceGroup = 'DescribeResourceGroup',
  ListResourceGroups = 'ListResourceGroups',
  TransferNode = 'TransferNode',
  TransferReplica = 'TransferReplica',
  CreateDatabase = 'CreateDatabase',
  ListDatabases = 'ListDatabases',
  DropDatabase = 'DropDatabase',
  CreateAlias = 'CreateAlias',
  DropAlias = 'DropAlias',
  DescribeAlias = 'DescribeAlias',
  ListAliases = 'ListAliases',
}

// RBAC: user privileges
export enum UserPrivileges {
  UpdateUser = 'UpdateUser',
  SelectUser = 'SelectUser',
}

// RBAC: all privileges
export const Privileges = {
  ...CollectionPrivileges,
  ...UserPrivileges,
  ...GlobalPrivileges,
};

// Collection load state enum
export enum LoadState {
  LoadStateNotExist = 'LoadStateNotExist',
  LoadStateNotLoad = 'LoadStateNotLoad',
  LoadStateLoading = 'LoadStateLoading',
  LoadStateLoaded = 'LoadStateLoaded',
}

export enum ShowCollectionsType {
  All,
  Loaded,
}

export enum RANKER_TYPE {
  RRF = 'rrf',
  WEIGHTED = 'weighted',
}
