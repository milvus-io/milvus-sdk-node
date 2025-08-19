import { f32ArrayToBf16Bytes } from '../../utils/Bytes';
import { validateFloatVector } from './FloatVector';

export function validateBFloat16Vector(
  value: unknown,
  field: any
): { value: Uint8Array; size: number } {
  const dim = Number(field.dim) || 0;
  // Check if value is already a base64 string
  if (typeof value === 'string') {
    try {
      const buffer = Buffer.from(value, 'base64');
      if (buffer.length !== dim * 2) {
        throw new Error(
          `Invalid BFloat16Vector base64: expected length ${
            dim * 2
          } bytes, got ${buffer.length}`
        );
      }
      return { value: new Uint8Array(buffer), size: buffer.length };
    } catch (error) {
      throw new Error(`Invalid base64 string for BFloat16Vector: ${error}`);
    }
  }

  // Check if value is already bytes (Uint8Array)
  if (value instanceof Uint8Array) {
    if (value.length !== dim * 2) {
      throw new Error(
        `Invalid BFloat16Vector bytes: expected length ${dim * 2}, got ${
          value.length
        }`
      );
    }
    return { value: value, size: value.length };
  }

  // Value is an array, validate and convert to bytes
  const validatedVector = validateFloatVector(value, field);
  const bf16Bytes = f32ArrayToBf16Bytes(validatedVector.value);
  return { value: new Uint8Array(bf16Bytes), size: bf16Bytes.length };
}
