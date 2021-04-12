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

export type CollectionSchema = {
  // collection name
  collection_name: string;
  // dimension
  dimension: number;
  // index file size
  index_file_size: number;
  // metric type
  metric_type: MetricType;
  extra_params?: [{ [key: string]: number | string }];
};

export type CollectionName = {
  // collection name
  collection_name: string;
};

export type PreloadCollectionParam = {
  collection_name: string;
  partition_tag_array: string[];
};

export type IndexParam = {
  collection_name: string;
  index_type: IndexType;
  extra_params?: [{ [key: string]: number | string }];
};

export type PartitionParam = {
  collection_name: string;
  tag: string;
};

export type InsertParam = {
  // collection name
  collection_name: string;
  // partition tag
  partition_tag: string;
  // raw entities array
  row_record_array: any;
  row_id_array?: number[];
  extra_params?: [{ [key: string]: number | string }];
};

export type VectorsParam = {
  collection_name: string;
  id_array: number[];
};

export type VectorsIdentity = {
  collection_name: string;
  id_array: number[];
};

export type SearchParam = {
  // collection name
  collection_name: string;
  // partition tag array
  partition_tag_array: string[];
  query_record_array?: { [x: string]: number[] }[];
  topk: number;
  extra_params: { [x: string]: any }[];
};

export type SearchByIDParam = SearchParam & {
  id_array: number[];
};

export type DeleteByIDParam = {
  collection_name: string;
  id_array: number[];
};

export type FlushParam = {
  collection_name_array: string[];
};

export type MilvusClient = {
  CreateCollection: Function;
  HasCollection: Function;
  DescribeCollection: Function;
  CountCollection: Function;
  ShowCollections: Function;
  ShowCollectionInfo: Function;
  DropCollection: Function;
  CreateIndex: Function;
  DescribeIndex: Function;
  DropIndex: Function;
  CreatePartition: Function;
  HasPartition: Function;
  ShowPartitions: Function;
  DropPartition: Function;
  Insert: Function;
  GetVectorsByID: Function;
  GetVectorIDs: Function;
  Search: Function;
  SearchByID: Function;
  SearchInFiles: Function;
  Cmd: Function;
  DeleteByID: Function;
  PreloadCollection: Function;
  Flush: Function;
  Compact: Function;
  CreateHybridCollection: Function;
  HasHybridCollection: Function;
  DropHybridCollection: Function;
  DescribeHybridCollection: Function;
  CountHybridCollection: Function;
  ShowHybridCollections: Function;
  ShowHybridCollectionInfo: Function;
  PreloadHybridCollection: Function;
  InsertEntity: Function;
  HybridSearch: Function;
  HybridSearchInSegments: Function;
  GetEntityByID: Function;
  GetEntityIDs: Function;
  DeleteEntitiesByID: Function;
};

export enum ErrorCode {
  SUCCESS = "SUCCESS",
  UNEXPECTED_ERROR = "UNEXPECTED_ERROR",
  CONNECT_FAILED = "CONNECT_FAILED",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  COLLECTION_NOT_EXISTS = "COLLECTION_NOT_EXISTS",
  ILLEGAL_ARGUMENT = "ILLEGAL_ARGUMENT",
  ILLEGAL_DIMENSION = "ILLEGAL_DIMENSION",
  ILLEGAL_INDEX_TYPE = "ILLEGAL_INDEX_TYPE",
  ILLEGAL_COLLECTION_NAME = "ILLEGAL_COLLECTION_NAME",
  ILLEGAL_TOPK = "ILLEGAL_TOPK",
  ILLEGAL_ROWRECORD = "ILLEGAL_ROWRECORD",
  ILLEGAL_VECTOR_ID = "ILLEGAL_VECTOR_ID",
  ILLEGAL_SEARCH_RESULT = "ILLEGAL_SEARCH_RESULT",
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  META_FAILED = "META_FAILED",
  CACHE_FAILED = "CACHE_FAILED",
  CANNOT_CREATE_FOLDER = "CANNOT_CREATE_FOLDER",
  CANNOT_CREATE_FILE = "CANNOT_CREATE_FILE",
  CANNOT_DELETE_FOLDER = "CANNOT_DELETE_FOLDER",
  CANNOT_DELETE_FILE = "CANNOT_DELETE_FILE",
  BUILD_INDEX_ERROR = "BUILD_INDEX_ERROR",
  ILLEGAL_NLIST = "ILLEGAL_NLIST",
  ILLEGAL_METRIC_TYPE = "ILLEGAL_METRIC_TYPE",
  OUT_OF_MEMORY = "OUT_OF_MEMORY",
}
