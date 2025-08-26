import { promises as fs } from 'fs';
import * as path from 'path';
import { CollectionSchema, FieldSchema } from '../types/Collection';
import { DataType } from '..';
import { BulkFileType } from './constants';
import Long from 'long';

/**
 * In-memory columnar buffer aligned with collection schema.
 * Supports dynamic field via `$meta`.
 */
export class Buffer {
  private columns: Record<string, any[]> = {}; // column name -> column values
  private fields: Record<string, FieldSchema> = {}; // field name -> field schema
  private fileType: BulkFileType;
  private columnNames: string[] = []; // cached column names to avoid Object.keys() calls
  private _rowCount: number = 0; // cached row count to avoid repeated calculations
  private estimatedRowSizes: number[] = []; // cached estimated sizes for each row to avoid JSON serialization
  private rowObjectPool: Record<string, any>[] = []; // object pool to reduce GC pressure
  private poolIndex: number = 0; // current index in the object pool
  private directoryCache: Set<string> = new Set(); // cache for directory existence checks

  constructor(options: { schema: CollectionSchema; fileType?: BulkFileType }) {
    const { schema, fileType = BulkFileType.JSON } = options;
    this.fileType = fileType;

    for (const f of schema.fields) {
      if (f.is_primary_key && f.autoID) continue;
      if (f.is_function_output) continue;
      this.columns[f.name] = [];
      this.fields[f.name] = f as FieldSchema;
    }

    // Cache column names to avoid repeated Object.keys() calls
    this.columnNames = Object.keys(this.columns);

    if (this.columnNames.length === 0) {
      throw new Error('Illegal collection schema: fields list is empty');
    }
  }

  get rowCount(): number {
    return this._rowCount;
  }

  appendRow(row: Record<string, any>) {
    // Process each field in the row
    for (const key in row) {
      if (key in row) {
        const value = row[key];
        const column = this.columns[key];

        if (column !== undefined) {
          column.push(value);
        }
      }
    }

    // Update cached row count and estimate row size
    this._rowCount++;
    this.estimatedRowSizes.push(this.estimateRowSize(row));
  }

  /**
   * Persist current buffer to storage as a batch.
   * Only JSON is supported in initial version.
   */
  async persist(
    localPath: string,
    opts: { bufferSize?: number; bufferRowCount?: number } = {}
  ): Promise<string[]> {
    // Use cached row count - columns are guaranteed to have equal length after appendRow
    if (this._rowCount === 0) {
      return [];
    }

    switch (this.fileType) {
      case BulkFileType.JSON:
        return this.persistJSONRows(localPath);
      default:
        throw new Error(`Unsupported file type: ${this.fileType}`);
    }
  }

  /**
   * Persist data to files with size limit, supporting both local and remote paths.
   * @param targetPath Target path (can be local file path or remote key)
   * @param maxSizeBytes Maximum size in bytes for each file
   * @param options Additional options
   * @returns Object containing file paths, rows processed, and remaining rows
   */
  async persistPartial(
    targetPath: string,
    maxSizeBytes: number,
    options?: {
      bufferSize?: number;
      bufferRowCount?: number;
    }
  ): Promise<{
    files: string[];
    rowsProcessed: number;
    remainingRows: number;
  }> {
    // Check if this is a remote path (starts with s3://)
    if (targetPath.startsWith('s3://')) {
      return this.persistPartialToRemote(targetPath, maxSizeBytes, options);
    } else {
      return this.persistPartialToLocal(targetPath, maxSizeBytes, options);
    }
  }

  /**
   * Helper: custom replacer for JSON.stringify to handle int64 special format
   */
  private static int64Replacer(_key: string, value: any) {
    if (
      value &&
      typeof value === 'object' &&
      value.type === 'int64' &&
      typeof value.value === 'string'
    ) {
      // Return a special marker object for post-processing
      return { __INT64__: value.value };
    }
    if (Array.isArray(value)) {
      return value;
    }
    return value;
  }

  /**
   * Helper: post-process JSON string to replace {"__INT64__":"123"} with 123 (no quotes)
   */
  private static replaceInt64Markers(json: string): string {
    // Replace all occurrences of {"__INT64__":"number"} with the number (no quotes)
    return json.replace(/\{\s*"__INT64__"\s*:\s*"(-?\d+)"\s*\}/g, '$1');
  }

  /**
   * Estimate the size of a value without expensive JSON serialization
   * This provides a fast approximation for size calculation
   */
  private estimateValueSize(value: any): number {
    if (value === null || value === undefined) {
      return 4; // "null" or "undefined"
    }

    switch (typeof value) {
      case 'string':
        return value.length + 2; // +2 for quotes
      case 'number':
        return value.toString().length;
      case 'boolean':
        return value ? 4 : 5; // "true" or "false"
      case 'object':
        if (Array.isArray(value)) {
          // Estimate array size: brackets + comma separators + element sizes
          let size = 2; // []
          for (let i = 0; i < value.length; i++) {
            if (i > 0) size += 1; // comma
            size += this.estimateValueSize(value[i]);
          }
          return size;
        } else {
          // Estimate object size: braces + key-value pairs + separators
          let size = 2; // {}
          const keys = Object.keys(value);
          for (let i = 0; i < keys.length; i++) {
            if (i > 0) size += 1; // comma
            const key = keys[i];
            size += key.length + 2; // key + quotes
            size += 1; // colon
            size += this.estimateValueSize(value[key]);
          }
          return size;
        }
      default:
        return 8; // fallback estimate
    }
  }

  /**
   * Estimate the total size of a row including field names and separators
   */
  private estimateRowSize(row: Record<string, any>): number {
    let size = 2; // {}
    const keys = Object.keys(row);
    for (let i = 0; i < keys.length; i++) {
      if (i > 0) size += 1; // comma
      const key = keys[i];
      size += key.length + 2; // key + quotes
      size += 1; // colon
      size += this.estimateValueSize(row[key]);
    }
    return size;
  }

  /**
   * Estimate row size from column data without creating the row object
   * This is used as a fallback when cached size is not available
   */
  private estimateRowSizeFromColumns(rowIndex: number): number {
    let size = 2; // {}
    for (let i = 0; i < this.columnNames.length; i++) {
      if (i > 0) size += 1; // comma
      const fieldName = this.columnNames[i];
      size += fieldName.length + 2; // field name + quotes
      size += 1; // colon
      const value = this.columns[fieldName][rowIndex];
      size += this.estimateValueSize(value);
    }
    return size;
  }

  /**
   * Get a row object from the pool or create a new one
   * This reduces GC pressure by reusing objects
   */
  private getRowFromPool(): Record<string, any> {
    if (this.poolIndex < this.rowObjectPool.length) {
      const row = this.rowObjectPool[this.poolIndex];
      this.poolIndex++;
      // Clear the object for reuse
      for (const key in row) {
        delete row[key];
      }
      return row;
    } else {
      // Create new object and add to pool
      const row = {};
      this.rowObjectPool.push(row);
      this.poolIndex++;
      return row;
    }
  }

  /**
   * Reset the object pool index for reuse
   */
  private resetObjectPool(): void {
    this.poolIndex = 0;
  }

  /**
   * Clear directory cache (useful for testing or when directories might change)
   */
  clearDirectoryCache(): void {
    this.directoryCache.clear();
  }

  /**
   * Common logic for processing rows up to a size limit
   */
  private processRowsUpToSizeLimit(maxSizeBytes: number): {
    rows: Record<string, any>[];
    rowsProcessed: number;
    remainingRows: number;
  } {
    if (this.columnNames.length === 0 || this._rowCount === 0) {
      return { rows: [], rowsProcessed: 0, remainingRows: 0 };
    }

    const totalRowCount = this._rowCount;
    let rowsProcessed = 0;
    let currentSize = 0;
    const rows: Record<string, any>[] = [];

    // Reset object pool for reuse
    this.resetObjectPool();

    for (let rowIndex = 0; rowIndex < totalRowCount; rowIndex++) {
      const row = this.getRowFromPool();

      // Use cached row size if available, otherwise estimate
      const rowSize =
        this.estimatedRowSizes[rowIndex] ||
        this.estimateRowSizeFromColumns(rowIndex);

      for (const k of this.columnNames) {
        const value = this.columns[k][rowIndex];
        const serializedValue = this.serializeValue(value, k);
        row[k] = serializedValue;
      }

      if (currentSize + rowSize > maxSizeBytes && rowsProcessed > 0) {
        break;
      }

      rows.push(row);
      currentSize += rowSize;
      rowsProcessed++;
    }

    return {
      rows,
      rowsProcessed,
      remainingRows: totalRowCount - rowsProcessed,
    };
  }

  /**
   * Common logic for writing JSON data to file
   */
  private async writeJSONToFile(
    filePath: string,
    rows: Record<string, any>[]
  ): Promise<void> {
    const dir = path.dirname(filePath);

    // Use directory cache to avoid repeated mkdir calls
    if (!this.directoryCache.has(dir)) {
      try {
        await fs.mkdir(dir, { recursive: true });
        this.directoryCache.add(dir);
      } catch (error) {
        // If directory already exists, add to cache anyway
        if (error.code !== 'EEXIST') {
          throw error;
        }
        this.directoryCache.add(dir);
      }
    }

    // Prepare JSON data
    let json = JSON.stringify({ rows }, Buffer.int64Replacer, 2);
    json = Buffer.replaceInt64Markers(json);

    // Use writeFile with buffer for better performance on large files
    const buffer = globalThis.Buffer.from(json, 'utf-8');
    await fs.writeFile(filePath, buffer);
  }

  /**
   * Persist data to local files with size limit.
   * @param localPath Local file path
   * @param maxSizeBytes Maximum size in bytes for each file
   * @param options Additional options
   * @returns Object containing file paths, rows processed, and remaining rows
   */
  private async persistPartialToLocal(
    localPath: string,
    maxSizeBytes: number,
    options?: {
      bufferSize?: number;
      bufferRowCount?: number;
    }
  ): Promise<{
    files: string[];
    rowsProcessed: number;
    remainingRows: number;
  }> {
    const { rows, rowsProcessed, remainingRows } =
      this.processRowsUpToSizeLimit(maxSizeBytes);

    if (rowsProcessed === 0) {
      return { files: [], rowsProcessed: 0, remainingRows };
    }

    const filePath = `${localPath}.json`;
    await this.writeJSONToFile(filePath, rows);

    return {
      files: [filePath],
      rowsProcessed,
      remainingRows,
    };
  }

  /**
   * Persist data to remote storage with size limit.
   * @param remoteKey Remote storage key
   * @param maxSizeBytes Maximum size in bytes for each file
   * @param options Additional options
   * @returns Object containing file paths, rows processed, and remaining rows
   */
  private async persistPartialToRemote(
    remoteKey: string,
    maxSizeBytes: number,
    options?: {
      bufferSize?: number;
      bufferRowCount?: number;
    }
  ): Promise<{
    files: string[];
    rowsProcessed: number;
    remainingRows: number;
  }> {
    const { rows, rowsProcessed, remainingRows } =
      this.processRowsUpToSizeLimit(maxSizeBytes);

    if (rowsProcessed === 0) {
      return { files: [], rowsProcessed: 0, remainingRows };
    }

    // For remote storage, we create a temporary local file that will be uploaded
    // The file path should be unique to avoid conflicts
    const tempFileName = `${remoteKey.replace(
      /[^a-zA-Z0-9]/g,
      '_'
    )}_${Date.now()}.json`;

    // Use the current working directory + remoteKey for temporary file location
    // This ensures files are created in the expected test-remote-path directory
    const tempFilePath = path.join(process.cwd(), tempFileName);

    await this.writeJSONToFile(tempFilePath, rows);

    return {
      files: [tempFilePath], // Return temp file path for upload
      rowsProcessed,
      remainingRows,
    };
  }

  /**
   * Remove processed rows from the buffer after partial flush.
   */
  removeProcessedRows(count: number): void {
    if (count <= 0) return;

    for (const k of this.columnNames) {
      this.columns[k] = this.columns[k].slice(count);
    }

    // Update cached row count and remove processed row sizes
    this._rowCount -= count;
    this.estimatedRowSizes.splice(0, count);
  }

  private async persistJSONRows(localPath: string): Promise<string[]> {
    const rows: Record<string, any>[] = [];
    if (this.columnNames.length === 0 || this._rowCount === 0) return [];
    const rowCount = this._rowCount;

    // Reset object pool for reuse
    this.resetObjectPool();

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const row = this.getRowFromPool();
      for (const k of this.columnNames) {
        const value = this.columns[k][rowIndex];
        row[k] = this.serializeValue(value, k);
      }
      rows.push(row);
    }

    const filePath = `${localPath}.json`;
    await this.writeJSONToFile(filePath, rows);
    return [filePath];
  }

  /**
   * Serialize values to ensure proper handling of special types
   * Handles BigInt, Long objects for int64 fields, and Uint8Array for vector fields
   */
  private serializeValue(value: any, fieldName?: string): any {
    // Handle field-specific serialization first
    if (fieldName && this.fields[fieldName]) {
      const field = this.fields[fieldName];

      switch (field.dataType) {
        case DataType.Float16Vector:
        case DataType.BFloat16Vector:
        case DataType.Int8Vector:
          return this.serializeVectorValue(value);
        default:
          break;
      }
    }
    // Handle general serialization for all other cases
    return this.serializeGeneralValue(value);
  }

  /**
   * Serialize vector values to base64 string
   */
  private serializeVectorValue(value: any): string | any {
    // For vector fields, accept any TypedArray (not DataView) and serialize
    if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
      const typed = value as ArrayBufferView;
      return globalThis.Buffer.from(
        typed.buffer as ArrayBuffer,
        typed.byteOffset,
        typed.byteLength
      ).toString('base64');
    }
    return value;
  }

  /**
   * Serialize general values (non-field-specific)
   */
  private serializeGeneralValue(value: any): any {
    if (
      value &&
      typeof value === 'object' &&
      value.type === 'int64' &&
      typeof value.value === 'string'
    ) {
      return { type: 'int64', value: value.value };
    }
    switch (typeof value) {
      case 'bigint':
        return { type: 'int64', value: value.toString() };
      default:
        if (Long.isLong(value)) {
          return { type: 'int64', value: value.toString() };
        }
        if (value instanceof Uint8Array || value instanceof Int8Array) {
          const typed = value as ArrayBufferView;
          return globalThis.Buffer.from(
            typed.buffer as ArrayBuffer,
            typed.byteOffset,
            typed.byteLength
          ).toString('base64');
        }
        return value;
    }
  }
}
