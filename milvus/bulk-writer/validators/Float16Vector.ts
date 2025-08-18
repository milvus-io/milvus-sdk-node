import { f32ArrayToF16Bytes } from '../../utils/Bytes';
import { validateFloatVector } from './FloatVector';

export function validateFloat16Vector(
  value: unknown,
  dim: number
): { value: Uint8Array; size: number } {
  // Check if value is already a base64 string
  if (typeof value === 'string') {
    try {
      const buffer = Buffer.from(value, 'base64');
      if (buffer.length !== dim * 2) {
        throw new Error(
          `Invalid Float16Vector base64: expected length ${
            dim * 2
          } bytes, got ${buffer.length}`
        );
      }
      return { value: new Uint8Array(buffer), size: buffer.length };
    } catch (error) {
      throw new Error(`Invalid base64 string for Float16Vector: ${error}`);
    }
  }

  // Check if value is already bytes (Uint8Array)
  if (value instanceof Uint8Array) {
    if (value.length !== dim * 2) {
      throw new Error(
        `Invalid Float16Vector bytes: expected length ${dim * 2}, got ${
          value.length
        }`
      );
    }
    return { value: value, size: value.length };
  }

  // Value is an array, validate and convert to bytes
  const validatedVector = validateFloatVector(value, dim);
  const f16Bytes = f32ArrayToF16Bytes(validatedVector.value);
  return { value: new Uint8Array(f16Bytes), size: f16Bytes.length };
}
