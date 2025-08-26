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
  private isAsyncFlushing = false; // Prevent concurrent async flushes

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
    this.makeDirectoriesSync();
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

    // Auto-flush when buffer size exceeds chunk size, but only if not already flushing
    if (
      this.currentBufferSize > this.currentChunkSize &&
      !this.isAsyncFlushing
    ) {
      this.flushBuffer({ async: true });
    }
  }

  /**
   * Commit current buffer and flush to local storage.
   */
  async commit(options: CommitOptions = {}): Promise<void> {
    const { async = false, callback } = options;

    // Flush any remaining data in the buffer
    if (this.currentBufferSize > 0) {
      // console.log('Flushing buffer', this.currentBufferSize);
      await this.flushBuffer({ async, callback });
    }
  }

  /**
   * Internal method to flush buffer to local files.
   */
  private async flushBuffer(options: CommitOptions = {}): Promise<void> {
    const { async = false, callback } = options;

    if (async) {
      // Prevent concurrent async flushes
      if (this.isAsyncFlushing) {
        return;
      }

      this.isAsyncFlushing = true;

      // Fire and forget - don't await, return immediately
      setImmediate(async () => {
        try {
          await this.flushChunkedData(callback);
          // Reset buffer metrics after async completion
          this.bufferSize = 0;
          this.bufferRowCount = 0;
        } catch (error) {
          // console.error('Async flush failed:', error);
        } finally {
          this.isAsyncFlushing = false;
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
      const targetPath = path.join(this.localPath, this.flushCount.toString());

      try {
        // Use partial flush to respect chunk size
        const result = await this.buffer.persistPartial(
          targetPath,
          this.chunkSize,
          {
            bufferSize: this.currentBufferSize,
            bufferRowCount: this.currentBufferRowCount,
          }
        );

        // console.log(`Chunk ${this.flushCount}: files=${result.files.length}, rowsProcessed=${result.rowsProcessed}, remainingRows=${result.remainingRows}, bufferRows=${this.buffer.rowCount}`);

        if (result.files.length > 0) {
          allFiles.push(...result.files);
          totalRowsProcessed += result.rowsProcessed;

          // Remove processed rows from the buffer
          this.buffer.removeProcessedRows(result.rowsProcessed);

          // If no rows were processed, break to avoid infinite loop
          if (result.rowsProcessed === 0) {
            console.log(`Breaking loop: rowsProcessed=${result.rowsProcessed}`);
            break;
          }
        } else {
          // No files were created, break to avoid infinite loop
          // console.log(`Breaking loop: no files created`);
          break;
        }
      } catch (error) {
        console.error(`Flush chunk ${this.flushCount} failed:`, error);
        throw error;
      }
    }

    // Add all generated files to the local files list
    this.localFiles.push(...allFiles);

    if (callback) {
      callback(allFiles);
    }

    // console.log(`Total flushed: ${totalRowsProcessed} rows across ${allFiles.length} files`);
  }

  /**
   * Clean up temporary files and directories.
   * @param force If true, ignores cleanupOnExit flag and forces cleanup
   */
  async cleanup(force: boolean = false): Promise<void> {
    if (!force && !this.cleanupOnExit) return;

    try {
      // Preserve JSON files by moving them to the parent directory before cleanup
      const parentDir = path.dirname(this.localPath);

      // Move all JSON files to parent directory to preserve them
      for (const filePath of this.localFiles) {
        try {
          const fileName = path.basename(filePath);
          const targetPath = path.join(parentDir, fileName);

          // Check if source file exists before moving
          const exists = await fs
            .access(filePath)
            .then(() => true)
            .catch(() => false);
          if (exists) {
            await fs.rename(filePath, targetPath);
          }
        } catch (error) {
          // console.warn(`Failed to preserve file ${filePath}:`, error);
        }
      }

      // Clear the localFiles array reference
      this.localFiles = [];

      // Clean up UUID directory (which is currently this.localPath)
      const uuidDir = this.localPath;
      const exists = await fs
        .access(uuidDir)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        await fs.rm(uuidDir, { recursive: true, force: true });
      }

      // The parent directory now contains the preserved JSON files for inspection
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  }

  /**
   * Create necessary directories for data storage.
   */
  private makeDirectoriesSync() {
    const uuidDir = path.join(this.localPath, this.writerUuid);
    this.localPath = uuidDir;
  }
}
