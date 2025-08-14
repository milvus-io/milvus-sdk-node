import { CollectionSchema } from '../types/Collection';
import { BulkFileType } from './constants';

/**
 * Configuration options for BulkWriter
 */
export interface BulkWriterOptions {
  /** Collection schema for validation */
  schema: CollectionSchema;
  /** Chunk size in bytes (default: 128MB) */
  chunkSize?: number;
  /** Output file type (default: JSON) */
  fileType?: BulkFileType;
  /** Additional configuration options */
  config?: {
    /** Enable strict validation mode */
    strictValidation?: boolean;
    /** Skip invalid rows instead of throwing errors */
    skipInvalidRows?: boolean;
    /** Clean up temporary files on exit (default: true) */
    cleanupOnExit?: boolean;
    /** Int64 handling strategy (default: 'auto') */
    int64Strategy?: 'auto' | 'string' | 'number' | 'bigint';
  };
}

/**
 * Configuration options for LocalBulkWriter
 */
export interface LocalBulkWriterOptions extends BulkWriterOptions {
  /** Local file system path for data storage */
  localPath: string;
}

/**
 * Options for commit operations
 */
export interface CommitOptions {
  /** Whether to flush asynchronously (default: false) */
  async?: boolean;
  /** Callback function called after flush completion */
  callback?: (files: string[]) => void;
}

/**
 * Options for bulk import operations
 */
export interface BulkImportOptions {
  /** Target collection name */
  collectionName: string;
  /** Database name (optional) */
  dbName?: string;
  /** Partition name (optional) */
  partitionName?: string;
  /** File paths for import */
  files?: string[][];
  /** Object storage URL (optional) */
  objectUrl?: string;
  /** Cluster ID for cloud deployments */
  clusterId?: string;
  /** Access key for object storage */
  accessKey?: string;
  /** Secret key for object storage */
  secretKey?: string;
  /** Stage name for cloud deployments */
  stageName?: string;
  /** Data file paths */
  dataPaths?: string[][];
  /** Additional import options */
  options?: Record<string, any>;
}

/**
 * Options for waiting for import completion
 */
export interface WaitForImportOptions {
  /** Job ID to wait for */
  jobId: string;
  /** Cluster ID (optional) */
  clusterId?: string;
  /** Polling interval in milliseconds (default: 5000) */
  pollInterval?: number;
  /** Timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
}

/**
 * Response from import job creation
 */
export interface ImportJobResponse {
  /** Unique job identifier */
  jobId: string;
  /** Job status */
  status: string;
  /** Optional status message */
  message?: string;
}

/**
 * Response from import progress query
 */
export interface ImportProgressResponse {
  /** Job identifier */
  jobId: string;
  /** Current job state */
  state: string;
  /** Number of rows processed */
  rowCount: number;
  /** List of processed IDs */
  idList: number[];
  /** Additional information */
  infos: Array<{ key: string; value: string }>;
  /** Collection ID */
  collectionId: number;
  /** Segment IDs */
  segmentIds: number[];
  /** Creation timestamp */
  createTs: number;
}
