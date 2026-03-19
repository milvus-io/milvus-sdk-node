import { EventEmitter } from 'events';
import * as path from 'path';
import * as crypto from 'crypto';
import { DataType, convertToDataType, FieldType } from '../';
import {
  BulkWriterOptions,
  BulkWriterSchema,
  FlushEvent,
  Storage,
} from './Types';
import { Formatter } from './Types';
import { ColumnBuffer } from './ColumnBuffer';
import { JsonFormatter } from './JsonFormatter';
import { ParquetFormatter } from './ParquetFormatter';
import { LocalStorage } from './LocalStorage';

const DEFAULT_CHUNK_SIZE = 128 * 1024 * 1024; // 128MB

export class BulkWriter extends EventEmitter {
  private schema: BulkWriterSchema;
  private buffer: ColumnBuffer;
  private bufferSize = 0;
  private formatter: Formatter;
  private storage: Storage;
  private chunkSize: number;
  private basePath: string;
  private _batchFiles: string[][] = [];
  private _totalRowCount = 0;
  private chunkIndex = 0;
  private pendingFlush: Promise<void> | null = null;

  // Pre-computed field metadata for validation
  private autoIdFields: Set<string>;
  private functionOutputFields: Set<string>;
  private requiredFields: FieldType[];
  private fieldMap: Map<string, FieldType>;

  constructor(options: BulkWriterOptions) {
    super();
    // Deep-clone schema to avoid mutation by external callers (e.g. createCollection)
    this.schema = JSON.parse(JSON.stringify(options.schema));
    this.formatter =
      options.format === 'parquet'
        ? new ParquetFormatter()
        : new JsonFormatter();
    this.storage = options.storage ?? new LocalStorage();
    this.chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    this.basePath = path.join(
      options.localPath ?? process.cwd(),
      crypto.randomUUID()
    );
    this.buffer = new ColumnBuffer(this.schema);

    // Pre-compute field metadata
    this.autoIdFields = new Set(
      this.schema.fields.filter(f => f.autoID).map(f => f.name)
    );
    this.functionOutputFields = new Set(
      this.schema.fields.filter(f => f.is_function_output).map(f => f.name)
    );
    this.requiredFields = this.schema.fields.filter(
      f =>
        !f.autoID &&
        !f.is_function_output &&
        !f.nullable &&
        f.default_value === undefined
    );
    this.fieldMap = new Map(this.schema.fields.map(f => [f.name, f]));
  }

  get totalRowCount(): number {
    return this._totalRowCount;
  }

  get bufferRowCount(): number {
    return this.buffer.rowCount;
  }

  get batchFiles(): string[][] {
    return this._batchFiles;
  }

  /** Append a single row. Triggers auto-flush when buffer exceeds chunkSize. */
  async append(row: Record<string, any>): Promise<void> {
    if (this.pendingFlush) await this.pendingFlush;
    this.validateRow(row);
    this.bufferSize += this.buffer.append(row);
    this._totalRowCount++;
    if (this.bufferSize >= this.chunkSize) {
      await this.commit();
    }
  }

  /** Flush the current buffer to disk. */
  async commit(): Promise<void> {
    if (this.pendingFlush) await this.pendingFlush;
    if (this.buffer.rowCount === 0) return;

    const oldBuffer = this.buffer;
    this.buffer = new ColumnBuffer(this.schema);
    this.bufferSize = 0;

    const chunkIdx = this.chunkIndex++;
    this.pendingFlush = this.flush(oldBuffer, chunkIdx);
    await this.pendingFlush;
    this.pendingFlush = null;
  }

  /** Flush remaining data and return all batch file paths. */
  async close(): Promise<string[][]> {
    if (this.buffer.rowCount > 0) {
      await this.commit();
    }
    if (this.pendingFlush) await this.pendingFlush;
    return this._batchFiles;
  }

  /** Write all rows from an async iterable, then close. */
  async writeFrom(
    source: AsyncIterable<Record<string, any>>
  ): Promise<string[][]> {
    for await (const row of source) {
      await this.append(row);
    }
    return this.close();
  }

  private async flush(buffer: ColumnBuffer, chunkIdx: number): Promise<void> {
    const chunkDir = path.join(this.basePath, `chunk_${chunkIdx}`);
    const localFiles = await this.formatter.persist(
      buffer.getColumns(),
      buffer.dynamicRows,
      buffer.rowCount,
      chunkDir,
      this.schema
    );
    const storedFiles = await Promise.all(
      localFiles.map(f => this.storage.write(f, f))
    );
    this._batchFiles.push(storedFiles);
    const event: FlushEvent = {
      files: storedFiles,
      rowCount: buffer.rowCount,
      chunkIndex: chunkIdx,
    };
    this.emit('flush', event);
  }

  private validateRow(row: Record<string, any>): void {
    // Reject autoID fields if provided
    for (const name of this.autoIdFields) {
      if (row[name] !== undefined) {
        throw new Error(`Field "${name}" is autoID — do not provide a value.`);
      }
    }

    // Reject function output fields if provided
    for (const name of this.functionOutputFields) {
      if (row[name] !== undefined) {
        throw new Error(
          `Field "${name}" is a function output field — do not provide a value.`
        );
      }
    }

    // Check required fields
    for (const field of this.requiredFields) {
      if (row[field.name] === undefined || row[field.name] === null) {
        throw new Error(
          `Field "${field.name}" is required (non-nullable, no default).`
        );
      }
    }

    // Validate $meta if provided
    if (row['$meta'] !== undefined && row['$meta'] !== null) {
      if (typeof row['$meta'] !== 'object' || Array.isArray(row['$meta'])) {
        throw new Error('$meta must be a plain object.');
      }
    }

    // Type-specific validation for provided values
    for (const [key, val] of Object.entries(row)) {
      if (val === null || val === undefined) continue;
      if (key === '$meta') continue; // handled by ColumnBuffer
      const field = this.fieldMap.get(key);
      if (!field) continue; // dynamic or extra field — skip validation
      this.validateFieldValue(field, val);
    }
  }

  private validateFieldValue(field: FieldType, val: any): void {
    const dt = convertToDataType(field.data_type);
    const dim = Number(
      field.dim ?? (field.type_params && field.type_params.dim)
    );

    switch (dt) {
      case DataType.FloatVector: {
        if (!Array.isArray(val)) {
          throw new Error(
            `Field "${field.name}": FloatVector must be a number array.`
          );
        }
        if (dim && val.length !== dim) {
          throw new Error(
            `Field "${field.name}": expected dimension ${dim}, got ${val.length}.`
          );
        }
        break;
      }
      case DataType.BinaryVector: {
        if (!Array.isArray(val)) {
          throw new Error(
            `Field "${field.name}": BinaryVector must be a number array.`
          );
        }
        if (dim && val.length !== dim / 8) {
          throw new Error(
            `Field "${field.name}": BinaryVector expected ${dim / 8} bytes for dimension ${dim}, got ${val.length}.`
          );
        }
        break;
      }
      case DataType.Float16Vector:
      case DataType.BFloat16Vector: {
        if (!Array.isArray(val) && !(val instanceof Uint8Array)) {
          throw new Error(
            `Field "${field.name}": Float16/BFloat16 vector must be a number array or Uint8Array.`
          );
        }
        if (dim && Array.isArray(val) && val.length !== dim) {
          throw new Error(
            `Field "${field.name}": expected dimension ${dim}, got ${val.length}.`
          );
        }
        break;
      }
      case DataType.Int8Vector: {
        if (!Array.isArray(val) && !(val instanceof Int8Array)) {
          throw new Error(
            `Field "${field.name}": Int8Vector must be a number array or Int8Array.`
          );
        }
        if (dim && val.length !== dim) {
          throw new Error(
            `Field "${field.name}": expected dimension ${dim}, got ${val.length}.`
          );
        }
        break;
      }
      case DataType.VarChar: {
        if (typeof val !== 'string') {
          throw new Error(`Field "${field.name}": VarChar must be a string.`);
        }
        const maxLen = Number(
          field.max_length ??
            (field.type_params && field.type_params.max_length)
        );
        if (maxLen && val.length > maxLen) {
          throw new Error(
            `Field "${field.name}": string length ${val.length} exceeds max_length ${maxLen}.`
          );
        }
        break;
      }
      case DataType.Array: {
        if (!Array.isArray(val)) {
          throw new Error(
            `Field "${field.name}": Array field must be an array.`
          );
        }
        const maxCap = Number(
          field.max_capacity ??
            (field.type_params && field.type_params.max_capacity)
        );
        if (maxCap && val.length > maxCap) {
          throw new Error(
            `Field "${field.name}": array length ${val.length} exceeds max_capacity ${maxCap}.`
          );
        }
        break;
      }
      case DataType.Geometry: {
        if (typeof val !== 'string') {
          throw new Error(
            `Field "${field.name}": Geometry must be a WKT string.`
          );
        }
        break;
      }
      case DataType.Timestamptz: {
        if (typeof val !== 'string' && !(val instanceof Date)) {
          throw new Error(
            `Field "${field.name}": Timestamptz must be an ISO 8601 string or Date object.`
          );
        }
        break;
      }
      case DataType.JSON: {
        if (typeof val !== 'object' || Array.isArray(val)) {
          throw new Error(
            `Field "${field.name}": JSON must be a plain object.`
          );
        }
        break;
      }
      case DataType.Bool:
        if (typeof val !== 'boolean') {
          throw new Error(`Field "${field.name}": Bool must be a boolean.`);
        }
        break;
      case DataType.Int8:
      case DataType.Int16:
      case DataType.Int32:
      case DataType.Float:
      case DataType.Double:
        if (typeof val !== 'number') {
          throw new Error(`Field "${field.name}": expected a number.`);
        }
        break;
    }
  }
}
