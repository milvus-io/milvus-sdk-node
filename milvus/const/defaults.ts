import { DataType } from './';

// defaults
export const DEFAULT_DEBUG = false;

export const DEFAULT_MILVUS_PORT = 19530; // default milvus port
export const DEFAULT_CONNECT_TIMEOUT = 15 * 1000; // 15s
export const DEFAULT_TOPK = 100; // default topk
export const DEFAULT_METRIC_TYPE = 'L2';
export const DEFAULT_MAX_RETRIES = 3; // max retry time
export const DEFAULT_RETRY_DELAY = 30; // retry delay, 30ms
export const DEFAULT_PARTITIONS_NUMBER = 64;
export const DEFAULT_RESOURCE_GROUP = '__default_resource_group';
export const DEFAULT_DB = 'default';
export const DEFAULT_DYNAMIC_FIELD = '$meta';

export const DEFAULT_HIGH_LEVEL_SCHEMA = (dimension: number) => [
  {
    name: 'id',
    data_type: DataType.Int64,
    is_primary_key: true,
    autoID: false,
  },
  {
    name: 'vector',
    data_type: DataType.FloatVector,
    dim: dimension,
  },
];
