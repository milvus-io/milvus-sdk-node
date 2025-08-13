import { DataType } from '..';

// Size helpers
export const KB = 1024;
export const MB = KB * 1024;
export const GB = MB * 1024;

// Internal dynamic field name aligned with pymilvus
export const DYNAMIC_FIELD_NAME = '$meta';

// File types supported by the bulk writer
export enum BulkFileType {
  NUMPY = 1, // reserved, not implemented in Node SDK yet
  JSON = 2,
  PARQUET = 3, // reserved, not implemented in initial version
  CSV = 4,
}

// Scalar byte sizes for rough buffer size estimation
export const TYPE_SIZE: Record<string, number> = {
  [DataType.Bool]: 1,
  [DataType.Int8]: 1,
  [DataType.Int16]: 2,
  [DataType.Int32]: 4,
  [DataType.Int64]: 8,
  [DataType.Float]: 4,
  [DataType.Double]: 8,
};

// Simple runtime guards for non-vector types
export const isScalarValid: Record<string, (x: unknown) => boolean> = {
  [DataType.Bool]: x => typeof x === 'boolean',
  [DataType.Int8]: x =>
    Number.isInteger(x as number) &&
    (x as number) >= -128 &&
    (x as number) <= 127,
  [DataType.Int16]: x =>
    Number.isInteger(x as number) &&
    (x as number) >= -32768 &&
    (x as number) <= 32767,
  [DataType.Int32]: x =>
    Number.isInteger(x as number) &&
    (x as number) >= -2147483648 &&
    (x as number) <= 2147483647,
  [DataType.Int64]: x => {
    // For int64, we need to ensure proper 64-bit precision
    if (typeof x === 'bigint') {
      return true; // BigInt provides full 64-bit precision
    }
    
    // Check if it's a Long object (from 'long' library)
    if (x !== null && typeof x === 'object' && 'low' in x && 'high' in x && 'unsigned' in x) {
      return true;
    }
    
    // For regular numbers, check if they're within safe integer range
    if (typeof x === 'number' && Number.isInteger(x)) {
      // Only allow numbers that are within safe integer range to prevent precision loss
      return x >= Number.MIN_SAFE_INTEGER && x <= Number.MAX_SAFE_INTEGER;
    }
    
    return false;
  },
  [DataType.Float]: x => typeof x === 'number' && Number.isFinite(x as number),
  [DataType.Double]: x => typeof x === 'number' && Number.isFinite(x as number),
};
