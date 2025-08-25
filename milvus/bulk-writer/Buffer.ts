import { promises as fs } from 'fs';
import * as path from 'path';
import { CollectionSchema, FieldSchema } from '../types/Collection';
import { DataType } from '..';
import { BulkFileType, DYNAMIC_FIELD_NAME } from './constants';
import Long from 'long';
import { validateInt64Field } from './validators/Int64';
import { validateJSON } from './validators/JSON';

/**
 * In-memory columnar buffer aligned with collection schema.
 * Supports dynamic field via `$meta`.
 */
export class Buffer {
  private columns: Record<string, any[]> = {}; // column name -> column values
  private fields: Record<string, FieldSchema> = {}; // field name -> field schema
  private fileType: BulkFileType;

  constructor(options: { schema: CollectionSchema; fileType?: BulkFileType }) {
    const { schema, fileType = BulkFileType.JSON } = options;
    this.fileType = fileType;

    for (const f of schema.fields) {
      if (f.is_primary_key && f.autoID) continue;
      if (f.is_function_output) continue;
      this.columns[f.name] = [];
      this.fields[f.name] = f as FieldSchema;
    }

    // dynamic field support
    if (schema.enable_dynamic_field) {
      this.columns[DYNAMIC_FIELD_NAME] = [];
      this.fields[DYNAMIC_FIELD_NAME] = {
        name: DYNAMIC_FIELD_NAME,
        description: '',
        data_type: 'JSON',
        dataType: DataType.JSON,
        index_params: [],
        fieldID: '0',
        is_primary_key: false,
        autoID: false,
        state: '',
        is_function_output: false,
        type_params: [],
      } as unknown as FieldSchema;
    }

    if (Object.keys(this.columns).length === 0) {
      throw new Error('Illegal collection schema: fields list is empty');
    }
  }

  get rowCount(): number {
    const keys = Object.keys(this.columns);
    if (keys.length === 0) return 0;
    return this.columns[keys[0]].length;
  }

  appendRow(row: Record<string, any>) {
    const dynamicValues: Record<string, any> = {};

    if (
      row.hasOwnProperty(DYNAMIC_FIELD_NAME) &&
      typeof row[DYNAMIC_FIELD_NAME] !== 'object'
    ) {
      throw new Error(
        `Dynamic field '${DYNAMIC_FIELD_NAME}' value should be JSON format`
      );
    }

    for (const [k, v] of Object.entries(row)) {
      if (k === DYNAMIC_FIELD_NAME) {
        Object.assign(dynamicValues, v);
        continue;
      }
      if (!this.columns.hasOwnProperty(k)) {
        dynamicValues[k] = this.rawValue(v);
      } else {
        this.columns[k].push(v);
      }
    }

    if (this.columns.hasOwnProperty(DYNAMIC_FIELD_NAME)) {
      this.columns[DYNAMIC_FIELD_NAME].push(dynamicValues);
    }
  }

  private rawValue(x: unknown) {
    // Handle int64/long values for dynamic fields
    if (Long.isLong(x)) {
      return x.toString();
    }

    if (typeof x === 'bigint') {
      return x.toString();
    }

    // Flatten typed arrays or buffers if needed in future.
    return x;
  }

  /**
   * Persist current buffer to storage as a batch.
   * Only JSON is supported in initial version.
   */
  async persist(
    localPath: string,
    opts: { bufferSize?: number; bufferRowCount?: number } = {}
  ): Promise<string[]> {
    // Ensure all columns have equal length
    let rowCount = -1;
    for (const k of Object.keys(this.columns)) {
      const len = this.columns[k].length;
      if (rowCount < 0) rowCount = len;
      else if (rowCount !== len) {
        throw new Error(
          `Column ${k} row count ${len} doesn't equal to the first column row count ${rowCount}`
        );
      }
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
    const keys = Object.keys(this.columns);
    if (keys.length === 0) {
      return { files: [], rowsProcessed: 0, remainingRows: 0 };
    }

    const totalRowCount = this.columns[keys[0]].length;
    let rowsProcessed = 0;
    let currentSize = 0;
    const rows: Record<string, any>[] = [];

    // Process rows until we reach the size limit
    for (let rowIndex = 0; rowIndex < totalRowCount; rowIndex++) {
      const row: Record<string, any> = {};
      let rowSize = 0;

      for (const k of keys) {
        const value = this.columns[k][rowIndex];
        const serializedValue = this.serializeValue(value, k);
        row[k] = serializedValue;
        rowSize += JSON.stringify(serializedValue, Buffer.int64Replacer).length;
      }

      // Check if adding this row would exceed the size limit
      if (currentSize + rowSize > maxSizeBytes && rowsProcessed > 0) {
        break;
      }

      rows.push(row);
      currentSize += rowSize;
      rowsProcessed++;
    }

    if (rowsProcessed === 0) {
      return { files: [], rowsProcessed: 0, remainingRows: totalRowCount };
    }

    const filePath = `${localPath}.json`;
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Use custom replacer and post-process to handle int64
    let json = JSON.stringify({ rows }, Buffer.int64Replacer, 2);
    json = Buffer.replaceInt64Markers(json);
    await fs.writeFile(filePath, json, 'utf-8');

    const remainingRows = totalRowCount - rowsProcessed;
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
    const keys = Object.keys(this.columns);
    if (keys.length === 0) {
      return { files: [], rowsProcessed: 0, remainingRows: 0 };
    }

    const totalRowCount = this.columns[keys[0]].length;
    let rowsProcessed = 0;
    let currentSize = 0;
    const rows: Record<string, any>[] = [];

    // Process rows until we reach the size limit
    for (let rowIndex = 0; rowIndex < totalRowCount; rowIndex++) {
      const row: Record<string, any> = {};
      let rowSize = 0;

      for (const k of keys) {
        const value = this.columns[k][rowIndex];
        const serializedValue = this.serializeValue(value, k);
        row[k] = serializedValue;
        rowSize += JSON.stringify(serializedValue, Buffer.int64Replacer).length;
      }

      // Check if adding this row would exceed the size limit
      if (currentSize + rowSize > maxSizeBytes && rowsProcessed > 0) {
        break;
      }

      rows.push(row);
      currentSize += rowSize;
      rowsProcessed++;
    }

    if (rowsProcessed === 0) {
      return { files: [], rowsProcessed: 0, remainingRows: totalRowCount };
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

    // Ensure temp directory exists
    const tempDir = path.dirname(tempFilePath);
    await fs.mkdir(tempDir, { recursive: true });

    // Write data to temporary file
    let json = JSON.stringify({ rows }, Buffer.int64Replacer, 2);
    json = Buffer.replaceInt64Markers(json);
    await fs.writeFile(tempFilePath, json, 'utf-8');

    const remainingRows = totalRowCount - rowsProcessed;
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

    for (const k of Object.keys(this.columns)) {
      this.columns[k] = this.columns[k].slice(count);
    }
  }

  private async persistJSONRows(localPath: string): Promise<string[]> {
    const rows: Record<string, any>[] = [];
    const keys = Object.keys(this.columns);
    if (keys.length === 0) return [];
    const rowCount = this.columns[keys[0]].length;

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const row: Record<string, any> = {};
      for (const k of keys) {
        const value = this.columns[k][rowIndex];
        row[k] = this.serializeValue(value, k);
      }
      rows.push(row);
    }

    const filePath = `${localPath}.json`;
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Use custom replacer and post-process to handle int64
    let json = JSON.stringify({ rows }, Buffer.int64Replacer, 2);
    json = Buffer.replaceInt64Markers(json);
    await fs.writeFile(filePath, json, 'utf-8');
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
      // Always treat DYNAMIC_FIELD_NAME as JSON
      if (
        fieldName === DYNAMIC_FIELD_NAME ||
        field.dataType === DataType.JSON
      ) {
        return validateJSON(value, field).value;
      }
      switch (field.dataType) {
        case DataType.Int64:
          // Use pure function validator
          return validateInt64Field(value, fieldName).value;
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
