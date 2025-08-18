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
  validateFloat,
  validateDouble,
  Int64Validator,
} from './validators';
import { Buffer } from './Buffer';
import { BulkWriterOptions, CommitOptions } from './types';
import { DataType } from '../const';
import { sparseToBytes } from '../utils/Bytes';

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
      int64Strategy: 'auto',
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
      const validationResult = this.validateField(
        field,
        row[fieldName],
        fieldName
      );

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
    value: any,
    fieldName: string
  ): { value: any; size: number } {
    const dataType = field.dataType;

    // Unified field processor mapping
    const fieldProcessors: Record<
      DataType,
      () => { value: any; size: number }
    > = {
      // Vector types - all validators now return unified format
      [DataType.FloatVector]: () => {
        const dim = Number(field.dim) || 0;
        return validateFloatVector(value, dim);
      },

      [DataType.BinaryVector]: () => {
        const dim = Number(field.dim) || 0;
        return validateBinaryVector(value, dim);
      },

      [DataType.Int8Vector]: () => {
        const dim = Number(field.dim) || 0;
        return validateInt8Vector(value, dim);
      },

      [DataType.Float16Vector]: () => {
        const dim = Number(field.dim) || 0;
        return validateFloat16Vector(value, dim);
      },

      [DataType.BFloat16Vector]: () => {
        const dim = Number(field.dim) || 0;
        return validateBFloat16Vector(value, dim);
      },

      [DataType.SparseFloatVector]: () => {
        return validateSparseFloatVector(value);
      },

      // Complex types
      [DataType.VarChar]: () => {
        const maxLength = Number(field.max_length) || 65535;
        const validatedValue = validateVarchar(value, maxLength);
        return { value: validatedValue, size: validatedValue.length };
      },

      [DataType.JSON]: () => {
        if (!validateJSON(value)) {
          throw new Error(`Invalid JSON value for field '${fieldName}'`);
        }
        // Return a copy to avoid reference issues
        return {
          value: JSON.parse(JSON.stringify(value)),
          size: JSON.stringify(value).length,
        };
      },

      [DataType.Array]: () => {
        const maxCapacity = Number(field.max_capacity) || 1000;
        const elementType = field.element_type;
        if (!elementType) {
          throw new Error(
            `Array field '${fieldName}' must specify element_type`
          );
        }
        validateArray(value, maxCapacity);

        // Special handling for int64 arrays to apply int64 strategy
        if (elementType === 'Int64') {
          const validator = new Int64Validator(
            this.config?.int64Strategy || 'auto'
          );
          return validator.validateInt64Array(value, fieldName, maxCapacity);
        }

        // Return a copy to avoid reference issues
        return { value: [...value], size: (value as any[]).length * 8 };
      },

      // Basic scalar types
      [DataType.Bool]: () => {
        const validatedValue = validateBool(value);
        return { value: validatedValue, size: TYPE_SIZE[DataType.Bool] };
      },

      [DataType.Int8]: () => {
        const validatedValue = validateInt8(value);
        return { value: validatedValue, size: TYPE_SIZE[DataType.Int8] };
      },

      [DataType.Int16]: () => {
        const validatedValue = validateInt16(value);
        return { value: validatedValue, size: TYPE_SIZE[DataType.Int16] };
      },

      [DataType.Int32]: () => {
        const validatedValue = validateInt32(value);
        return { value: validatedValue, size: TYPE_SIZE[DataType.Int32] };
      },

      [DataType.Int64]: () => {
        const validator = new Int64Validator(
          this.config?.int64Strategy || 'auto'
        );
        return validator.validateInt64Field(value, fieldName);
      },

      [DataType.Float]: () => {
        const validatedValue = validateFloat(value);
        return { value: validatedValue, size: TYPE_SIZE[DataType.Float] };
      },

      [DataType.Double]: () => {
        const validatedValue = validateDouble(value);
        return { value: validatedValue, size: TYPE_SIZE[DataType.Double] };
      },

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
      `Unhandled data type: ${dataType} for field '${fieldName}'`
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
