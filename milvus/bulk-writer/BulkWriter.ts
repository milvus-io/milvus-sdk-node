import { CollectionSchema, FieldSchema } from '../types/Collection';
import { BulkFileType, TYPE_SIZE } from './constants';
import {
  validateFloatVector,
  validateBinaryVector,
  validateInt8Vector,
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
import { SparseFloatVector } from '../types/Data';

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

      // For vector fields and other complex types, always ensure we have a proper copy
      // to avoid reference issues and ensure data integrity
      if (
        this.isVectorField(field.dataType) ||
        (typeof validationResult.value === 'object' &&
          validationResult.value !== null)
      ) {
        // Special handling for Long objects to preserve type information
        if (Int64Validator.isLong(validationResult.value)) {
          row[fieldName] = validationResult.value;
        } else {
          row[fieldName] = validationResult.value;
        }
      } else {
        row[fieldName] = validationResult.value;
      }

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
      // Vector types
      [DataType.FloatVector]: () => {
        const dim = Number(field.dim) || 0;
        const validatedVector = validateFloatVector(value, dim);
        return { value: validatedVector, size: dim * 4 };
      },

      [DataType.BinaryVector]: () => {
        const dim = Number(field.dim) || 0;
        const validatedVector = validateBinaryVector(value, dim);
        return { value: validatedVector, size: Math.ceil(dim / 8) };
      },

      [DataType.Int8Vector]: () => {
        const dim = Number(field.dim) || 0;
        const validatedVector = validateInt8Vector(value, dim);
        return { value: validatedVector, size: dim };
      },

      [DataType.Float16Vector]: () => {
        const dim = Number(field.dim) || 0;
        const validatedVector = validateFloatVector(value, dim);
        return { value: validatedVector, size: dim * 2 };
      },

      [DataType.BFloat16Vector]: () => {
        const dim = Number(field.dim) || 0;
        const validatedVector = validateFloatVector(value, dim);
        return { value: validatedVector, size: dim * 2 };
      },

      [DataType.SparseFloatVector]: () => {
        // For sparse vectors, we don't need dim validation
        // Validate that sparse vector is in the correct object format with numeric keys
        const validatedVector = value;

        // Validate sparse vector format
        if (typeof validatedVector !== 'object' || validatedVector === null) {
          throw new Error(
            `Invalid sparse vector format: expected object, got ${typeof validatedVector}`
          );
        }

        // Check if it's an object with numeric string keys and number values
        const sparseObject = validatedVector as Record<string, any>;
        for (const [key, val] of Object.entries(sparseObject)) {
          // Check if key is a valid numeric string
          if (!/^\d+$/.test(key)) {
            throw new Error(
              `Invalid sparse vector key: expected numeric string, got '${key}'`
            );
          }

          // Check if value is a valid number
          if (typeof val !== 'number' || isNaN(val)) {
            throw new Error(
              `Invalid sparse vector value at key '${key}': expected number, got ${typeof val}`
            );
          }
        }

        const bytes = sparseToBytes(validatedVector as SparseFloatVector);
        return { value: validatedVector, size: bytes.length };
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
        return { value, size: JSON.stringify(value).length };
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

        return { value, size: (value as any[]).length * 8 };
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
        [DataType.VarChar]: () => String(value).length,
        [DataType.JSON]: () => JSON.stringify(value).length,
        [DataType.Array]: () => {
          const elementType = field.element_type;
          if (elementType === 'Int64') {
            return (value as any[]).length * 8;
          }
          return (value as any[]).length * 8;
        },
      };

      const sizeEstimator = sizeEstimators[dataType];
      if (sizeEstimator) {
        size += sizeEstimator();
      } else {
        // Fallback to type size constants
        const typeName = DataType[dataType];
        size += TYPE_SIZE[typeName] || 8;
      }
    }

    return size;
  }

  /**
   * Check if a field is a vector type
   */
  private isVectorField(dataType: DataType): boolean {
    return (
      dataType === DataType.FloatVector ||
      dataType === DataType.BinaryVector ||
      dataType === DataType.Int8Vector ||
      dataType === DataType.Float16Vector ||
      dataType === DataType.BFloat16Vector ||
      dataType === DataType.SparseFloatVector
    );
  }
}
