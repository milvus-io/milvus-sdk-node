import { randomUUID } from 'crypto';
import { BulkFileType, MB } from './constants';
import { BulkWriter } from './BulkWriter';
import {
  RemoteBulkWriterOptions,
  CommitOptions,
  S3ConnectParam,
} from './types';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
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
  private s3Client: any;
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

    // Initialize S3 client
    this.initializeS3Client();
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
   * Initialize S3/MinIO client
   */
  private initializeS3Client(): void {
    try {
      this.s3Client = new S3Client({
        endpoint: this.connectParam.endpoint,
        region: this.connectParam.region || 'us-east-1',
        credentials: {
          accessKeyId: this.connectParam.accessKey,
          secretAccessKey: this.connectParam.secretKey,
          sessionToken: this.connectParam.sessionToken,
        },
        forcePathStyle: true, // Required for MinIO
      });

      console.log('S3/MinIO client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize S3 client:', error);
      throw new Error(
        'S3 client initialization failed. Please install @aws-sdk/client-s3 package.'
      );
    }
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
          // Upload files to S3/MinIO
          const uploadedFiles = await this.uploadFilesToS3(
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
   * Upload files to S3/MinIO
   */
  private async uploadFilesToS3(
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

        // Upload to S3/MinIO
        const uploadCommand = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: remoteKey,
          Body: fileContent,
          ContentType: 'application/json',
        });

        await this.s3Client.send(uploadCommand);

        // Add the remote path to uploaded files
        const remotePath = `s3://${this.bucketName}/${remoteKey}`;
        uploadedFiles.push(remotePath);

        // Clean up local file after successful upload
        await fs.unlink(localFile);
      }

      return uploadedFiles;
    } catch (error) {
      console.error('Failed to upload files to S3/MinIO:', error);
      throw error;
    }
  }

  /**
   * Ensure the bucket exists, create if it doesn't
   */
  private async ensureBucketExists(): Promise<void> {
    try {
      try {
        // Check if bucket exists
        await this.s3Client.send(
          new HeadBucketCommand({ Bucket: this.bucketName })
        );
      } catch (error: any) {
        if (
          error.name === 'NotFound' ||
          error.$metadata?.httpStatusCode === 404
        ) {
          // Bucket doesn't exist, create it
          await this.s3Client.send(
            new CreateBucketCommand({ Bucket: this.bucketName })
          );
          console.log(`Bucket '${this.bucketName}' created successfully`);
        } else {
          throw error;
        }
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
      if (this.s3Client) {
        // List all objects in the writer's directory
        const listCommand = new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: `${this.remotePath}/${this.writerUuid}/`,
        });

        const listResult = await this.s3Client.send(listCommand);

        if (listResult.Contents && listResult.Contents.length > 0) {
          // Delete all objects in the writer's directory
          const deletePromises = listResult.Contents.map((obj: any) => {
            const deleteCommand = new DeleteObjectCommand({
              Bucket: this.bucketName,
              Key: obj.Key,
            });
            return this.s3Client.send(deleteCommand);
          });

          await Promise.all(deletePromises);
          console.log(`Cleaned up ${listResult.Contents.length} remote files`);
        }
      }

      // Clear the remoteFiles array reference
      this.remoteFiles = [];
    } catch (error) {
      console.warn('Remote cleanup failed:', error);
    }
  }
}
