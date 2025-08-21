import { randomUUID } from 'crypto';
import { BulkFileType, MB } from './constants';
import { BulkWriter } from './BulkWriter';
import {
  RemoteBulkWriterOptions,
  CommitOptions,
  S3ConnectParam,
} from './types';
import { Client as MinioClient } from 'minio';
import { promises as fs } from 'fs';

/**
 * Bulk writer that stores data to S3/MinIO object storage.
 * Automatically manages chunking and file organization in the cloud.
 */
export class RemoteBulkWriter extends BulkWriter {
  private remotePath: string;
  private writerUuid: string;
  private flushCount = 0;
  private remoteFiles: string[] = [];
  private cleanupOnExit: boolean;
  private minioClient!: MinioClient;
  private bucketName: string;
  private connectParam: S3ConnectParam;

  constructor(options: RemoteBulkWriterOptions) {
    const {
      schema,
      remotePath,
      connectParam,
      bucketName = 'milvus-bulk-data',
      chunkSize = 128 * MB,
      fileType = BulkFileType.JSON,
      config = {},
    } = options;

    super({ schema, chunkSize, fileType, config });
    this.remotePath = remotePath;
    this.writerUuid = randomUUID();
    this.cleanupOnExit = config.cleanupOnExit ?? true;
    this.bucketName = bucketName;
    this.connectParam = connectParam;

    // Initialize MinIO client
    this.initializeMinioClient();
  }

  get uuid(): string {
    return this.writerUuid;
  }

  get dataPath(): string {
    return this.remotePath;
  }

  get batchFiles(): string[] {
    return this.remoteFiles;
  }

  /**
   * Initialize MinIO client
   */
  private initializeMinioClient(): void {
    try {
      // Parse endpoint to extract host and port
      const { hostname, port, protocol } = this.parseEndpoint(
        this.connectParam.endpoint
      );

      this.minioClient = new MinioClient({
        endPoint: hostname,
        port: port || this.getDefaultPort(protocol),
        useSSL: protocol === 'https:',
        accessKey: this.connectParam.accessKey,
        secretKey: this.connectParam.secretKey,
        sessionToken: this.connectParam.sessionToken,
        region: this.connectParam.region || 'us-east-1',
      });

      console.log('MinIO client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MinIO client:', error);
      throw new Error(
        'MinIO client initialization failed. Please check your connection parameters.'
      );
    }
  }

  /**
   * Parse endpoint URL to extract components
   */
  private parseEndpoint(endpoint: string): {
    hostname: string;
    port?: number;
    protocol: string;
  } {
    // If endpoint doesn't have protocol, add http:// for parsing
    const urlString = endpoint.includes('://')
      ? endpoint
      : `http://${endpoint}`;
    const url = new URL(urlString);

    return {
      hostname: url.hostname,
      port: url.port ? parseInt(url.port, 10) : undefined,
      protocol: url.protocol,
    };
  }

  /**
   * Get default port based on protocol
   */
  private getDefaultPort(protocol: string): number {
    return protocol === 'https:' ? 443 : 80;
  }

  /**
   * Add a row and automatically flush if buffer exceeds chunk size.
   */
  appendRow(row: Record<string, any>): void {
    super.appendRow(row);

    // Auto-flush when buffer size exceeds chunk size
    if (this.currentBufferSize > this.currentChunkSize) {
      this.flushBuffer({ async: true });
    }
  }

  /**
   * Commit current buffer and flush to remote storage.
   */
  async commit(options: CommitOptions = {}): Promise<void> {
    const { async = false, callback } = options;

    // Flush any remaining data in the buffer
    if (this.currentBufferSize > 0) {
      await this.flushBuffer({ async, callback });
    }
  }

  /**
   * Internal method to flush buffer to remote files.
   */
  private async flushBuffer(options: CommitOptions = {}): Promise<void> {
    const { async = false, callback } = options;

    if (async) {
      // Fire and forget - don't await, return immediately
      setImmediate(async () => {
        try {
          await this.flushChunkedData(callback);
          // Reset buffer metrics after async completion
          this.bufferSize = 0;
          this.bufferRowCount = 0;
        } catch (error) {
          console.error('Async flush failed:', error);
        }
      });
      return; // Return immediately for async mode
    } else {
      // Synchronous execution - await completion
      await this.flushChunkedData(callback);
      // Reset buffer metrics after sync completion
      this.bufferSize = 0;
      this.bufferRowCount = 0;
    }
  }

  /**
   * Flush data in chunks according to the configured chunk size.
   */
  private async flushChunkedData(
    callback?: (files: string[]) => void
  ): Promise<void> {
    if (!this.buffer || this.buffer.rowCount === 0) {
      return;
    }

    let totalRowsProcessed = 0;
    const allFiles: string[] = [];

    // Continue flushing chunks until all data is processed
    while (this.buffer && this.buffer.rowCount > 0) {
      this.flushCount++;
      const fileName = `${this.flushCount}.json`;
      const remoteKey = `${this.remotePath}/${this.writerUuid}/${fileName}`;

      try {
        // Use partial flush to respect chunk size
        const result = await this.buffer.persistPartial(
          remoteKey,
          this.chunkSize,
          {
            bufferSize: this.currentBufferSize,
            bufferRowCount: this.currentBufferRowCount,
          }
        );

        if (result.files.length > 0) {
          // Upload files to MinIO
          const uploadedFiles = await this.uploadFilesToMinio(
            result.files,
            remoteKey
          );
          allFiles.push(...uploadedFiles);
          totalRowsProcessed += result.rowsProcessed;

          // Remove processed rows from the buffer
          this.buffer.removeProcessedRows(result.rowsProcessed);

          // If no rows were processed or no remaining rows, break to avoid infinite loop
          if (result.rowsProcessed === 0 || result.remainingRows === 0) {
            break;
          }
        } else {
          // No files were created, break to avoid infinite loop
          break;
        }
      } catch (error) {
        console.error(`Flush chunk ${this.flushCount} failed:`, error);
        throw error;
      }
    }

    // Add all generated files to the remote files list
    this.remoteFiles.push(...allFiles);

    if (callback) {
      callback(allFiles);
    }
  }

  /**
   * Upload files to MinIO
   */
  private async uploadFilesToMinio(
    localFiles: string[],
    remoteKey: string
  ): Promise<string[]> {
    const uploadedFiles: string[] = [];

    try {
      // Ensure bucket exists
      await this.ensureBucketExists();

      for (const localFile of localFiles) {
        // Read file content
        const fileContent = await fs.readFile(localFile, 'utf-8');

        // Upload to MinIO
        await this.minioClient.putObject(
          this.bucketName,
          remoteKey,
          fileContent,
          fileContent.length,
          {
            'Content-Type': 'application/json',
          }
        );

        // Add the remote path to uploaded files
        const remotePath = `s3://${this.bucketName}/${remoteKey}`;
        uploadedFiles.push(remotePath);

        // Clean up local file after successful upload
        await fs.unlink(localFile);
      }

      return uploadedFiles;
    } catch (error) {
      console.error('Failed to upload files to MinIO:', error);
      throw error;
    }
  }

  /**
   * Ensure the bucket exists, create if it doesn't
   */
  private async ensureBucketExists(): Promise<void> {
    try {
      const bucketExists = await this.minioClient.bucketExists(this.bucketName);
      if (!bucketExists) {
        // Bucket doesn't exist, create it
        await this.minioClient.makeBucket(
          this.bucketName,
          this.connectParam.region || 'us-east-1'
        );
        console.log(`Bucket '${this.bucketName}' created successfully`);
      }
    } catch (error) {
      console.error('Failed to ensure bucket exists:', error);
      throw error;
    }
  }

  /**
   * Clean up remote files and resources.
   * @param force If true, ignores cleanupOnExit flag and forces cleanup
   */
  async cleanup(force: boolean = false): Promise<void> {
    if (!force && !this.cleanupOnExit) return;

    try {
      if (this.minioClient) {
        // List all objects in the writer's directory
        const objectsStream = this.minioClient.listObjects(
          this.bucketName,
          `${this.remotePath}/${this.writerUuid}/`,
          true
        );

        const objectsToDelete: string[] = [];

        // Collect all objects to delete
        for await (const obj of objectsStream) {
          objectsToDelete.push(obj.name);
        }

        if (objectsToDelete.length > 0) {
          // Delete all objects in the writer's directory
          await this.minioClient.removeObjects(
            this.bucketName,
            objectsToDelete
          );
          console.log(`Cleaned up ${objectsToDelete.length} remote files`);
        }
      }

      // Clear the remoteFiles array reference
      this.remoteFiles = [];
    } catch (error) {
      console.warn('Remote cleanup failed:', error);
    }
  }
}
