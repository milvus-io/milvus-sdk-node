import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { BulkFileType, MB } from './constants';
import { BulkWriter } from './BulkWriter';
import { LocalBulkWriterOptions, CommitOptions } from './types';

/**
 * Bulk writer that stores data to local file system.
 * Automatically manages chunking and file organization.
 */
export class LocalBulkWriter extends BulkWriter {
  private localPath: string;
  private writerUuid: string;
  private flushCount = 0;
  private localFiles: string[] = [];
  private cleanupOnExit: boolean;

  constructor(options: LocalBulkWriterOptions) {
    const {
      schema,
      localPath,
      chunkSize = 128 * MB,
      fileType = BulkFileType.JSON,
      config = {},
    } = options;

    super({ schema, chunkSize, fileType, config });
    this.localPath = localPath;
    this.writerUuid = randomUUID();
    this.cleanupOnExit = config.cleanupOnExit ?? true;
    this.makeDirectories();
  }

  get uuid(): string {
    return this.writerUuid;
  }

  get dataPath(): string {
    return this.localPath;
  }

  get batchFiles(): string[] {
    return this.localFiles;
  }

  /**
   * Add a row and automatically flush if buffer exceeds chunk size.
   */
  appendRow(row: Record<string, any>): void {
    super.appendRow(row);

    // Auto-flush when buffer size exceeds chunk size
    if (this.currentBufferSize > this.currentChunkSize) {
      this.commit({ async: true });
    }
  }

  /**
   * Commit current buffer and flush to local storage.
   */
  async commit(options: CommitOptions = {}): Promise<void> {
    const { async = false, callback } = options;

    // Flush strategy based on async flag
    const flushStrategies = {
      async: () => {
        setImmediate(async () => {
          try {
            await this.flush(callback);
          } catch (error) {
            console.error('Async flush failed:', error);
          }
        });
      },
      sync: () => this.flush(callback),
    };

    // Execute appropriate flush strategy
    await flushStrategies[async ? 'async' : 'sync']();

    // Reset buffer metrics
    this.bufferSize = 0;
    this.bufferRowCount = 0;
  }

  /**
   * Clean up temporary files and directories.
   */
  async cleanup(): Promise<void> {
    if (!this.cleanupOnExit) return;

    try {
      const uuidDir = path.join(this.localPath, this.uuid);
      const exists = await fs
        .access(uuidDir)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        const files = await fs.readdir(uuidDir);
        if (files.length === 0) {
          await fs.rmdir(uuidDir);
        }
      }
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  }

  /**
   * Create necessary directories for data storage.
   */
  private async makeDirectories(): Promise<void> {
    await fs.mkdir(this.localPath, { recursive: true });

    const uuidDir = path.join(this.localPath, this.uuid);
    await fs.mkdir(uuidDir, { recursive: true });

    this.localPath = uuidDir;
  }

  /**
   * Flush current buffer to local files.
   */
  private async flush(callback?: (files: string[]) => void): Promise<void> {
    this.flushCount++;
    const targetPath = path.join(this.localPath, this.flushCount.toString());

    const oldBuffer = this.newBuffer();
    if (oldBuffer && oldBuffer.rowCount > 0) {
      try {
        const fileList = await oldBuffer.persist(targetPath, {
          bufferSize: this.currentBufferSize,
          bufferRowCount: this.currentBufferRowCount,
        });

        this.localFiles.push(...fileList);

        if (callback) {
          callback(fileList);
        }
      } catch (error) {
        console.error('Flush failed:', error);
        throw error;
      }
    }
  }
}
