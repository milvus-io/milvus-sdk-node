// defaults
export const DEFAULT_MILVUS_PORT = 19530; // default milvus port
export const DEFAULT_CONNECT_TIMEOUT = 15 * 1000; // 15s
export const DEFAULT_TOPK = 100; // default topk
export const DEFAULT_METRIC_TYPE = 'L2'; // default metric type
export const DEFAULT_VECTOR_FIELD = 'vector'; // default vector field
export const DEFAULT_PRIMARY_KEY_FIELD = 'id'; // default primary key field
export const DEFAULT_MAX_RETRIES = 3; // max retry time
export const DEFAULT_RETRY_DELAY = 30; // retry delay, 30ms
export const DEFAULT_PARTITIONS_NUMBER = 64; // default partitions number
export const DEFAULT_RESOURCE_GROUP = '__default_resource_group'; // default resource group
export const DEFAULT_DB = 'default'; // default database name
export const DEFAULT_DYNAMIC_FIELD = '$meta'; // default dynamic field name
export const DEFAULT_COUNT_QUERY_STRING = 'count(*)'; // default count query string
export const DEFAULT_HTTP_TIMEOUT = 60000; // default http timeout, 60s
export const DEFAULT_HTTP_ENDPOINT_VERSION = 'v1'; // api version, default v1

export const DEFAULT_POOL_MAX = 10; // default max pool client number
export const DEFAULT_POOL_MIN = 2; // default min pool client number
