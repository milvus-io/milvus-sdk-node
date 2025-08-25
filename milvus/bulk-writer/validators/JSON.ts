import { validateInt64Field } from './Int64';
import Long from 'long';

function processInt64InJson(obj: any, fieldName: string): any {
  // Handle null values
  if (obj === null) {
    return null;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => processInt64InJson(item, fieldName));
  }

  if (obj && typeof obj === 'object' && !Long.isLong(obj)) {
    // Don't treat Long object as plain object
    const result: any = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = processInt64InJson(v, fieldName);
    }
    return result;
  }

  // Only convert to int64 if it's explicitly an int64 type
  // Don't convert regular strings, even if they look like numbers
  if (typeof obj === 'bigint' || Long.isLong(obj)) {
    return validateInt64Field(obj, fieldName).value;
  }

  // For numbers, only convert if they're beyond JS safe integer range
  if (typeof obj === 'number' && Number.isInteger(obj)) {
    if (obj < Number.MIN_SAFE_INTEGER || obj > Number.MAX_SAFE_INTEGER) {
      return validateInt64Field(obj, fieldName).value;
    }
    // Safe integers remain as numbers
    return obj;
  }

  // All other types (strings, booleans, etc.) remain unchanged
  return obj;
}

export function validateJSON(
  x: unknown,
  field: any
): { value: any; size: number } {
  // Allow null values
  if (x === null) {
    return {
      value: null,
      size: 4, // "null" is 4 characters
    };
  }

  if (
    !(
      typeof x === 'string' ||
      Array.isArray(x) ||
      (!!x && typeof x === 'object')
    )
  ) {
    throw new Error(`Invalid JSON value for field '${field.name}'`);
  }

  // Recursively process int64 in JSON
  const processed = processInt64InJson(x, field.name);
  return {
    value: JSON.parse(JSON.stringify(processed)),
    size: JSON.stringify(processed).length,
  };
}
