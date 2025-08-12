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
  [DataType.Int64]: x => Number.isInteger(x as number),
  [DataType.Float]: x => typeof x === 'number' && Number.isFinite(x as number),
  [DataType.Double]: x => typeof x === 'number' && Number.isFinite(x as number),
};
