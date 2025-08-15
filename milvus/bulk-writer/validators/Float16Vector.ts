import { f32ArrayToF16Bytes } from '../../utils/Bytes';
import { validateFloatVector } from './FloatVector';

export function validateFloat16Vector(value: unknown, dim: number): { value: Uint8Array; size: number } {
  // Check if value is already bytes (Uint8Array) or array (number[])
  if (value instanceof Uint8Array) {
    // Value is already in bytes format
    if (value.length !== dim * 2) {
      // 2 bytes per dimension for f16
      throw new Error(
        `Invalid Float16Vector bytes: expected length ${dim * 2}, got ${
          value.length
        }`
      );
    }
    return { value: value, size: value.length };
  } else {
    // Value is an array, validate and convert to bytes
    const validatedVector = validateFloatVector(value, dim);
    const f16Bytes = f32ArrayToF16Bytes(validatedVector);
    return { value: f16Bytes, size: f16Bytes.length };
  }
}
