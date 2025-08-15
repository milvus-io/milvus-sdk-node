import { f32ArrayToBf16Bytes } from '../../utils/Bytes';
import { validateFloatVector } from './FloatVector';

export function validateBFloat16Vector(value: unknown, dim: number): { value: Uint8Array; size: number } {
  // Check if value is already bytes (Uint8Array) or array (number[])
  if (value instanceof Uint8Array) {
    // Value is already in bytes format
    if (value.length !== dim * 2) {
      // 2 bytes per dimension for bf16
      throw new Error(
        `Invalid BFloat16Vector bytes: expected length ${dim * 2}, got ${
          value.length
        }`
      );
    }
    return { value: value, size: value.length };
  } else {
    // Value is an array, validate and convert to bytes
    const validatedVector = validateFloatVector(value, dim);
    const bf16Bytes = f32ArrayToBf16Bytes(validatedVector);
    return { value: bf16Bytes, size: bf16Bytes.length };
  }
}
