import { promises as fs } from 'fs';
import * as path from 'path';
import { CollectionSchema, FieldSchema } from '../types/Collection';
import { DataType } from '..';
import { BulkFileType, DYNAMIC_FIELD_NAME } from './constants';
import Long from 'long';

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

  private async persistJSONRows(localPath: string): Promise<string[]> {
    const rows: Record<string, any>[] = [];
    const keys = Object.keys(this.columns);
    if (keys.length === 0) return [];
    const rowCount = this.columns[keys[0]].length;

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const row: Record<string, any> = {};
      for (const k of keys) {
        const value = this.columns[k][rowIndex];
        row[k] = this.serializeValue(value);
      }
      rows.push(row);
    }

    const filePath = `${localPath}.json`;
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(filePath, JSON.stringify({ rows }, null, 2), 'utf-8');
    return [filePath];
  }

  /**
   * Serialize values to ensure proper handling of special types
   * Handles BigInt and Long objects for int64 fields
   */
  private serializeValue(value: any): any {
    // BigInt -> string
    if (typeof value === 'bigint') {
      return value.toString();
    }

    // Long -> string
    if (Long.isLong(value)) {
      return value.toString();
    }

    return value;
  }
}
