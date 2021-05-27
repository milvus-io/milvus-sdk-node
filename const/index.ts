export const IP = "127.0.0.1:19530";

export const DIMENSION = 4;

export const INDEX_FILE_SIZE = 1024;

export const GENERATE_COLLECTION_NAME = () =>
  `collection_${Math.random().toString(36).substr(2, 8)}`;

export const PARTITION_TAG = "random";
