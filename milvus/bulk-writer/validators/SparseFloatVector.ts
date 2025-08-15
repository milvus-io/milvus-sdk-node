import { SparseFloatVector } from '../../types/Data';

export function validateSparseFloatVector(x: unknown): SparseFloatVector {
  // Validate sparse vector format
  if (typeof x !== 'object' || x === null) {
    throw new Error(
      `Invalid sparse vector format: expected object, got ${typeof x}`
    );
  }

  // Check if it's an object with numeric string keys and number values
  const sparseObject = x as Record<string, any>;
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

  return x as SparseFloatVector;
}
