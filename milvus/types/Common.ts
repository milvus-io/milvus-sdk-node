export enum MetricType {
  GHOST = 0,
  // L2 euclidean distance
  L2 = 1,
  // IP inner product
  IP = 2,
  // HAMMING hamming distance
  HAMMING = 3,
  // JACCARD jaccard distance
  JACCARD = 4,
  // TANIMOTO tanimoto distance
  TANIMOTO = 5,
  // SUBSTRUCTURE substructure distance
  SUBSTRUCTURE = 6,
  // SUPERSTRUCTURE superstructure
  SUPERSTRUCTURE = 7,
}

export enum IndexType {
  // INVALID invald index type
  INVALID = 0,
  // FLAT flat
  FLAT = 1,
  // IVFFLAT ivfflat
  IVFFLAT = 2,
  // IVFSQ8 ivfsq8
  IVFSQ8 = 3,
  //RNSG rnsg
  RNSG = 4,
  // IVFSQ8H ivfsq8h
  IVFSQ8H = 5,
  // IVFPQ ivfpq
  IVFPQ = 6,
  // SPTAGKDT sptagkdt
  SPTAGKDT = 7,
  // SPTAGBKT sptagbkt
  SPTAGBKT = 8,
  // HNSW hnsw
  HNSW = 11,
  // ANNOY annoy
  ANNOY = 12,
}

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

  /* DEFINITION REQUESTS: INDEX */
  CreateIndex = 300,
  DescribeIndex = 301,
  DropIndex = 302,

  /* MANIPULATION REQUESTS */
  Insert = 400,
  Delete = 401,
  Flush = 402,

  /* QUERY */
  Search = 500,
  SearchResult = 501,
  GetIndexState = 502,
  GetIndexBuildProgress = 503,
  GetCollectionStatistics = 504,
  GetPartitionStatistics = 505,
  Retrieve = 506,
  RetrieveResult = 507,

  /* DATA SERVICE */
  SegmentInfo = 600,

  /* SYSTEM CONTROL */
  TimeTick = 1200,
  QueryNodeStats = 1201, // GOOSE TODO: Remove kQueryNodeStats
  LoadIndex = 1202,
  RequestID = 1203,
  RequestTSO = 1204,
  AllocateSegment = 1205,
  SegmentStatistics = 1206,
  SegmentFlushDone = 1207,
}

export interface MsgBase {
  base: {
    msg_type: MsgType; // required
  };
}

/**
 * @brief Field data type
 */
export enum DataType {
  None = 0,
  Bool = 1,
  Int8 = 2,
  Int16 = 3,
  Int32 = 4,
  Int64 = 5,

  Float = 10,
  Double = 11,

  String = 20,
  VarChar = 21, // variable-length strings with a specified maximum length

  BinaryVector = 100,
  FloatVector = 101,
}

export const DataTypeMap: { [x: string]: number } = {
  none: 0,
  bool: 1,
  int8: 2,
  int16: 3,
  int32: 4,
  int64: 5,
  float: 10,
  double: 11,
  string: 20,
  varchar: 21,
  binaryvector: 100,
  floatvector: 101,
};

export interface KeyValuePair {
  key: string;
  value: string | number;
}

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

interface NumberArray {
  data: Number[];
}

interface StringArray {
  data: String[];
}
export interface NumberArrayId {
  int_id: NumberArray;
}

export interface StringArrayId {
  str_id: StringArray;
}

export enum SegmentState {
  SegmentStateNone,
  NotExist,
  Growing,
  Sealed,
  Flushed = 'Flushed',
  Flushing = 'Flushing',
}

export enum CompactionState {
  UndefiedState = 0,
  Executing = 1,
  Completed = 2,
}

export interface GrpcTimeOut {
  timeout?: number;
}
