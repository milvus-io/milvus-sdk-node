import { CollectionSchema, FieldSchema } from '../types/Collection';
import { BulkFileType, TYPE_SIZE } from './constants';
import {
  validateFloatVector,
  validateBinaryVector,
  validateInt8Vector,
  validateSparseFloatVector,
  validateFloat16Vector,
  validateBFloat16Vector,
  validateVarchar,
  validateJSON,
  validateArray,
  validateBool,
  validateInt8,
  validateInt16,
  validateInt32,
  validateInt64,
  validateFloat,
  validateDouble,
} from './validators';
import { Buffer } from './Buffer';
import { BulkWriterOptions, CommitOptions } from './types';
import { DataType } from '../const';

/**
 * Base class for bulk data writing operations.
 * Handles data validation, buffering, and chunk management.
 */
export abstract class BulkWriter {
  protected schema: CollectionSchema;
  protected bufferSize = 0;
  protected bufferRowCount = 0;
  protected totalRowCount = 0;
  protected fileType: BulkFileType;
  protected chunkSize: number;
  protected config: BulkWriterOptions['config'];
  protected buffer: Buffer | null = null;

  constructor(options: BulkWriterOptions) {
    const {
      schema,
      chunkSize = 128 * 1024 * 1024,
      fileType = BulkFileType.JSON,
      config = {},
    } = options;

    this.schema = schema;
    this.chunkSize = chunkSize;
    this.fileType = fileType;
    this.config = {
      ...config,
    };

    if (schema.fields.length === 0) {
      throw new Error('Collection schema fields list is empty');
    }

    if (!schema.fields.find(f => f.is_primary_key)) {
      throw new Error('Primary field is required');
    }

    this.newBuffer();
  }

  get currentBufferSize(): number {
    return this.bufferSize;
  }

  get currentBufferRowCount(): number {
    return this.bufferRowCount;
  }

  get totalRows(): number {
    return this.totalRowCount;
  }

  get currentChunkSize(): number {
    return this.chunkSize;
  }

  /**
   * Add a row of data to the buffer.
   * Validates data against schema before buffering.
   */
  appendRow(row: Record<string, any>): void {
    this.verifyRow(row);

    if (this.buffer) {
      this.buffer.appendRow(row);
      this.bufferSize += this.estimateRowSize(row);
      this.bufferRowCount++;
      this.totalRowCount++;
    }
  }

  /**
   * Commit current buffer and optionally flush to storage.
   */
  abstract commit(options?: CommitOptions): Promise<void>;

  /**
   * Get the data path where files are stored.
   */
  abstract get dataPath(): string;

  /**
   * Create a new buffer instance.
   */
  protected newBuffer(): Buffer | null {
    const oldBuffer = this.buffer;
    this.buffer = new Buffer({ schema: this.schema, fileType: this.fileType });
    return oldBuffer;
  }

  /**
   * Verify and validate a row against the collection schema.
   */
  private verifyRow(row: Record<string, any>): void {
    if (typeof row !== 'object' || row === null) {
      throw new Error('Row must be a non-null object');
    }

    let rowSize = 0;

    for (const field of this.schema.fields) {
      if (field.is_primary_key && field.autoID) {
        if (row.hasOwnProperty(field.name)) {
          throw new Error(
            `Primary key field '${field.name}' is auto-id, no need to provide`
          );
        }
        continue;
      }

      if (field.is_function_output) {
        if (row.hasOwnProperty(field.name)) {
          throw new Error(
            `Field '${field.name}' is function output, no need to provide`
          );
        }
        continue;
      }

      const fieldName = field.name;

      // Handle nullable fields with default values
      if (field.nullable && field.default_value !== undefined) {
        if (!row.hasOwnProperty(fieldName) || row[fieldName] === null) {
          // Only deep copy if the field value is an object/array that might be shared
          if (
            typeof field.default_value === 'object' &&
            field.default_value !== null
          ) {
            row[fieldName] = JSON.parse(JSON.stringify(field.default_value));
          } else {
            row[fieldName] = field.default_value;
          }
          continue;
        }
      } else if (field.nullable) {
        if (!row.hasOwnProperty(fieldName) || row[fieldName] === null) {
          row[fieldName] = null;
          continue;
        }
      } else if (field.default_value !== undefined) {
        if (!row.hasOwnProperty(fieldName) || row[fieldName] === null) {
          // Only deep copy if the field value is an object/array that might be shared
          if (
            typeof field.default_value === 'object' &&
            field.default_value !== null
          ) {
            row[fieldName] = JSON.parse(JSON.stringify(field.default_value));
          } else {
            row[fieldName] = field.default_value;
          }
          continue;
        }
      } else if (!row.hasOwnProperty(fieldName) || row[fieldName] === null) {
        throw new Error(
          `Field '${fieldName}' is not nullable, null value not allowed`
        );
      }

      // Validate and calculate size based on data type using strategy pattern
      const validationResult = this.validateField(field, row[fieldName]);

      // The validateField method handles any necessary copying/transformation
      row[fieldName] = validationResult.value;

      rowSize += validationResult.size;
    }
  }

  /**
   * Validate a field and return validation result with size.
   */
  private validateField(
    field: FieldSchema,
    value: any
  ): { value: any; size: number } {
    const dataType = field.dataType;

    // Unified field processor mapping
    const fieldProcessors: Record<
      DataType,
      () => { value: any; size: number }
    > = {
      // Vector types - all validators now return unified format
      [DataType.FloatVector]: () => validateFloatVector(value, field),
      [DataType.BinaryVector]: () => validateBinaryVector(value, field),
      [DataType.Int8Vector]: () => validateInt8Vector(value, field),
      [DataType.Float16Vector]: () => validateFloat16Vector(value, field),
      [DataType.BFloat16Vector]: () => validateBFloat16Vector(value, field),
      [DataType.SparseFloatVector]: () =>
        validateSparseFloatVector(value, field),

      // Complex types
      [DataType.VarChar]: () => validateVarchar(value, field),

      [DataType.JSON]: () => validateJSON(value, field),

      [DataType.Array]: () => validateArray(value, field),

      // Basic scalar types
      [DataType.Bool]: () => validateBool(value, field),
      [DataType.Int8]: () => validateInt8(value, field),
      [DataType.Int16]: () => validateInt16(value, field),
      [DataType.Int32]: () => validateInt32(value, field),
      [DataType.Int64]: () => validateInt64(value, field),
      [DataType.Float]: () => validateFloat(value, field),
      [DataType.Double]: () => validateDouble(value, field),

      // Handle unsupported types
      [DataType.None]: () => {
        throw new Error(`Unsupported data type: ${DataType.None}`);
      },
    };

    // Process field using processor
    const processor = fieldProcessors[dataType];
    if (processor) {
      return processor();
    }

    // This should never happen since we now handle all DataType values
    throw new Error(
      `Unhandled data type: ${dataType} for field '${field.name}'`
    );
  }

  /**
   * Estimate the size of a row in bytes for buffer management.
   */
  private estimateRowSize(row: Record<string, any>): number {
    let size = 0;

    for (const field of this.schema.fields) {
      if (field.is_primary_key && field.autoID) continue;
      if (field.is_function_output) continue;

      const value = row[field.name];
      if (value === null || value === undefined) continue;

      const dataType = field.dataType;

      // Size estimation strategies
      const sizeEstimators: Partial<Record<DataType, () => number>> = {
        [DataType.FloatVector]: () => (Number(field.dim) || 0) * 4,
        [DataType.BinaryVector]: () => Math.ceil((Number(field.dim) || 0) / 8),
        [DataType.Int8Vector]: () => Number(field.dim) || 0,
        [DataType.Float16Vector]: () => (Number(field.dim) || 0) * 2,
        [DataType.BFloat16Vector]: () => (Number(field.dim) || 0) * 2,
        [DataType.SparseFloatVector]: () => {
          // Estimate sparse vector size based on number of non-zero elements
          if (typeof value === 'object' && value !== null) {
            return Object.keys(value).length * 12; // Rough estimate: 4 bytes for index + 8 bytes for value
          }
          return 0;
        },
        [DataType.VarChar]: () => String(value).length,
        [DataType.JSON]: () => JSON.stringify(value).length,
        [DataType.Array]: () => {
          const elementType = field.element_type;
          if (elementType === 'Int64') {
            return (value as any[]).length * 8;
          }
          // Default array element size estimation
          return (value as any[]).length * 8;
        },
      };

      const sizeEstimator = sizeEstimators[dataType];
      if (sizeEstimator) {
        size += sizeEstimator();
      } else {
        // Fallback to type size constants
        const typeSize = TYPE_SIZE[dataType];
        if (typeSize !== undefined) {
          size += typeSize;
        } else {
          // Default fallback size for unknown types
          size += 8;
        }
      }
    }

    return size;
  }
}
