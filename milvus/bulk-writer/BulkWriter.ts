import { CollectionSchema, FieldSchema } from '../types/Collection';
import { DataType } from '../const';
import { BulkFileType, TYPE_SIZE, isScalarValid } from './constants';
import {
  validateFloatVector,
  validateBinaryVector,
  validateInt8Vector,
  validateVarchar,
  validateJSON,
  validateArray,
} from './validators';
import { Buffer } from './Buffer';
import { BulkWriterOptions, CommitOptions } from './types';
import Long from 'long';

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
    this.config = config;

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
        if (Long.isLong && Long.isLong(validationResult.value)) {
          row[fieldName] = validationResult.value;
        }
        // For vector fields, ensure we preserve the array structure
        else if (Array.isArray(validationResult.value)) {
          row[fieldName] = [...validationResult.value];
        } else {
          row[fieldName] = JSON.parse(JSON.stringify(validationResult.value));
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
    const fieldProcessors: Partial<
      Record<DataType, () => { value: any; size: number }>
    > = {
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
        return { value, size: (value as any[]).length * 8 };
      },

      [DataType.Int64]: () => {
        // Special handling for int64 to ensure 64-bit precision
        if (typeof value === 'bigint') {
          return { value, size: 8 };
        }

        // Handle Long object from 'long' library
        if (
          value !== null &&
          typeof value === 'object' &&
          'low' in value &&
          'high' in value &&
          'unsigned' in value
        ) {
          return { value, size: 8 };
        }

        // For regular numbers, ensure they're within safe range
        if (typeof value === 'number' && Number.isInteger(value)) {
          if (
            value < Number.MIN_SAFE_INTEGER ||
            value > Number.MAX_SAFE_INTEGER
          ) {
            throw new Error(
              `Int64 field '${fieldName}' value ${value} is outside safe integer range. Use BigInt or Long for values beyond ±2^53-1`
            );
          }
          return { value, size: 8 };
        }

        throw new Error(
          `Invalid int64 value for field '${fieldName}'. Expected BigInt, Long object, or safe integer`
        );
      },
    };

    // Process field using processor or fallback to scalar validation
    const processor = fieldProcessors[dataType];
    if (processor) {
      return processor();
    }

    if (!isScalarValid[dataType] || !isScalarValid[dataType](value)) {
      throw new Error(`Invalid scalar value for field '${fieldName}'`);
    }
    return { value, size: TYPE_SIZE[dataType] || 8 };
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
        [DataType.Array]: () => (value as any[]).length * 8,
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
      dataType === DataType.Int8Vector
    );
  }
}
