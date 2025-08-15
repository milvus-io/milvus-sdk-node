// Minimal validators aligned with pymilvus behavior. These are intended for
// client-side checks to fail fast before formatting/flushing.

export function validateFloatVector(x: unknown, dim: number): number[] {
  if (!Array.isArray(x) || x.length !== dim) {
    throw new Error(`Invalid float vector: expected array with dim=${dim}`);
  }

  // Ensure all elements are valid numbers
  const result: number[] = [];
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(
        `Invalid float vector element at ${i}: expected number, got ${typeof v}`
      );
    }
    result.push(v);
  }
  return result;
}

export function validateBinaryVector(x: unknown, dim: number): number[] {
  // Binary vector is stored as bytes where 8 dim == 1 byte
  const byteLen = Math.ceil(dim / 8);

  // Handle bytes input (Uint8Array or Buffer)
  if (x instanceof Uint8Array) {
    if (x.length !== byteLen) {
      throw new Error(
        `Invalid binary vector bytes: expected length ${byteLen}, got ${x.length}`
      );
    }
    return Array.from(x);
  }
  
  if (x && typeof x === 'object' && x.constructor && x.constructor.name === 'Buffer') {
    const buffer = x as any;
    if (buffer.length !== byteLen) {
      throw new Error(
        `Invalid binary vector bytes: expected length ${byteLen}, got ${buffer.length}`
      );
    }
    return Array.from(buffer);
  }

  // Handle bit array input (e.g., [1, 0, 1, 1, 0, 0, 1, 0])
  if (Array.isArray(x)) {
    // Check if it's a bit array (all values are 0 or 1) AND length matches dimension
    const isBitArray = x.length === dim && x.every(v => v === 0 || v === 1);
    
    if (isBitArray) {
      // Convert bit array to bytes using packBits
      return packBits(x);
    } else {
      // Traditional byte array validation
      if (x.length !== byteLen) {
        throw new Error(
          `Invalid binary vector: expected array with length=${byteLen}`
        );
      }

      const result: number[] = [];
      for (let i = 0; i < x.length; i++) {
        const v = x[i];
        if (
          !Number.isInteger(v as number) ||
          (v as number) < 0 ||
          (v as number) > 255
        ) {
          throw new Error(
            `Invalid binary vector element at ${i}: expected integer 0-255, got ${v}`
          );
        }
        result.push(v as number);
      }
      return result;
    }
  }

  throw new Error(
    `Invalid binary vector: expected Uint8Array, Buffer, or array, got ${typeof x}`
  );
}

/**
 * Converts a bit array to bytes using packBits algorithm
 * @param bits - Array of bits (0 or 1)
 * @returns Array of bytes
 */
function packBits(bits: number[]): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8 && i + j < bits.length; j++) {
      if (bits[i + j]) {
        byte |= (1 << (7 - j)); // Set bit from left to right
      }
    }
    bytes.push(byte);
  }
  return bytes;
}

export function validateInt8Vector(x: unknown, dim: number): number[] {
  if (!Array.isArray(x) || x.length !== dim) {
    throw new Error(`Invalid int8 vector: expected array with dim=${dim}`);
  }

  const result: number[] = [];
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (
      !Number.isInteger(v as number) ||
      (v as number) < -128 ||
      (v as number) > 127
    ) {
      throw new Error(
        `Invalid int8 vector element at ${i}: expected integer -128 to 127, got ${v}`
      );
    }
    result.push(v as number);
  }
  return result;
}

export function validateVarchar(x: unknown, maxLength: number): string {
  if (typeof x !== 'string' || x.length > maxLength) {
    throw new Error(`Invalid varchar: expected string length <= ${maxLength}`);
  }
  return x;
}

export function validateJSON(x: unknown): boolean {
  return (
    typeof x === 'string' || Array.isArray(x) || (!!x && typeof x === 'object')
  );
}

export function validateArray(x: unknown, maxCapacity: number): unknown[] {
  if (!Array.isArray(x) || x.length > maxCapacity) {
    throw new Error(
      `Invalid array: expected array with length <= ${maxCapacity}`
    );
  }
  return x;
}

// Basic scalar type validators
export function validateBool(x: unknown): boolean {
  if (typeof x !== 'boolean') {
    throw new Error('Invalid boolean value: expected boolean');
  }
  return x;
}

export function validateInt8(x: unknown): number {
  if (
    !Number.isInteger(x as number) ||
    (x as number) < -128 ||
    (x as number) > 127
  ) {
    throw new Error('Invalid int8 value: expected integer -128 to 127');
  }
  return x as number;
}

export function validateInt16(x: unknown): number {
  if (
    !Number.isInteger(x as number) ||
    (x as number) < -32768 ||
    (x as number) > 32767
  ) {
    throw new Error('Invalid int16 value: expected integer -32768 to 32767');
  }
  return x as number;
}

export function validateInt32(x: unknown): number {
  if (
    !Number.isInteger(x as number) ||
    (x as number) < -2147483648 ||
    (x as number) > 2147483647
  ) {
    throw new Error(
      'Invalid int32 value: expected integer -2147483648 to 2147483647'
    );
  }
  return x as number;
}

export function validateInt64(x: unknown): number | string | bigint {
  // For int64, we need to ensure proper 64-bit precision
  if (typeof x === 'bigint') {
    return x; // BigInt provides full 64-bit precision
  }

  // Check if it's a Long object (from 'long' library)
  if (
    x !== null &&
    typeof x === 'object' &&
    'low' in x &&
    'high' in x &&
    'unsigned' in x
  ) {
    return x as any;
  }

  // For regular numbers, check if they're within safe integer range
  if (typeof x === 'number' && Number.isInteger(x)) {
    if (x < Number.MIN_SAFE_INTEGER || x > Number.MAX_SAFE_INTEGER) {
      throw new Error(
        'Int64 value is outside safe integer range. Use string or BigInt for values beyond ±2^53-1'
      );
    }
    return x;
  }

  // For strings, validate format and range
  if (typeof x === 'string') {
    if (!/^-?\d+$/.test(x)) {
      throw new Error('Invalid int64 string format: expected numeric string');
    }

    const bigIntValue = BigInt(x);
    if (
      bigIntValue < BigInt('-9223372036854775808') ||
      bigIntValue > BigInt('9223372036854775807')
    ) {
      throw new Error('Int64 value out of range: expected -2^63 to 2^63-1');
    }
    return x;
  }

  throw new Error(
    'Invalid int64 value: expected BigInt, Long object, safe integer, or numeric string'
  );
}

export function validateFloat(x: unknown): number {
  if (typeof x !== 'number' || !Number.isFinite(x)) {
    throw new Error('Invalid float value: expected finite number');
  }
  return x;
}

export function validateDouble(x: unknown): number {
  if (typeof x !== 'number' || !Number.isFinite(x)) {
    throw new Error('Invalid double value: expected finite number');
  }
  return x;
}

// Int64 validation utilities
export class Int64Validator {
  private int64Strategy: 'auto' | 'string' | 'number' | 'bigint';

  constructor(int64Strategy: 'auto' | 'string' | 'number' | 'bigint' = 'auto') {
    this.int64Strategy = int64Strategy;
  }

  /**
   * Static method to check if a value is a Long object
   */
  static isLong(value: any): boolean {
    return (
      value !== null &&
      typeof value === 'object' &&
      'low' in value &&
      'high' in value &&
      'unsigned' in value
    );
  }

  /**
   * Validate int64 field based on strategy
   */
  validateInt64Field(
    value: any,
    fieldName: string
  ): { value: any; size: number } {
    switch (this.int64Strategy) {
      case 'string':
        return this.validateInt64AsString(value, fieldName);
      case 'number':
        return this.validateInt64AsNumber(value, fieldName);
      case 'bigint':
        return this.validateInt64AsBigInt(value, fieldName);
      case 'auto':
      default:
        return this.validateInt64Auto(value, fieldName);
    }
  }

  /**
   * Validate int64 as string (preserves full precision)
   */
  private validateInt64AsString(
    value: any,
    fieldName: string
  ): { value: any; size: number } {
    if (typeof value === 'string') {
      // Validate string format
      if (!/^-?\d+$/.test(value)) {
        throw new Error(
          `Invalid int64 string format for field '${fieldName}': ${value}`
        );
      }

      // Check range for int64 (-2^63 to 2^63-1)
      const bigIntValue = BigInt(value);
      this.validateInt64Range(bigIntValue, fieldName);
      return { value, size: 8 };
    }

    // Convert other types to string
    if (typeof value === 'bigint') {
      return { value: value.toString(), size: 8 };
    }

    // Check if it's a Long object (from 'long' library)
    if (
      value !== null &&
      typeof value === 'object' &&
      'low' in value &&
      'high' in value &&
      'unsigned' in value
    ) {
      return { value: value.toString(), size: 8 };
    }

    if (typeof value === 'number' && Number.isInteger(value)) {
      this.validateSafeIntegerRange(value, fieldName);
      return { value: value.toString(), size: 8 };
    }

    throw new Error(
      `Invalid int64 value for field '${fieldName}'. Expected string, BigInt, Long object, or safe integer`
    );
  }

  /**
   * Common validation for int64 range checking
   */
  private validateInt64Range(value: bigint, fieldName: string): void {
    if (
      value < BigInt('-9223372036854775808') ||
      value > BigInt('9223372036854775807')
    ) {
      throw new Error(
        `Int64 value out of range for field '${fieldName}': ${value}`
      );
    }
  }

  /**
   * Common validation for safe integer range checking
   */
  private validateSafeIntegerRange(value: number, fieldName: string): void {
    if (value < Number.MIN_SAFE_INTEGER || value > Number.MAX_SAFE_INTEGER) {
      throw new Error(
        `Int64 field '${fieldName}' value ${value} is outside safe integer range. Use string or bigint strategy for values beyond ±2^53-1`
      );
    }
  }

  /**
   * Convert various types to BigInt with validation
   */
  private convertToBigInt(value: any, fieldName: string): bigint {
    if (typeof value === 'bigint') {
      return value;
    }

    // Check if it's a Long object (from 'long' library)
    if (
      value !== null &&
      typeof value === 'object' &&
      'low' in value &&
      'high' in value &&
      'unsigned' in value
    ) {
      return BigInt(value.toString());
    }

    if (typeof value === 'string') {
      if (!/^-?\d+$/.test(value)) {
        throw new Error(
          `Invalid int64 string format for field '${fieldName}': ${value}`
        );
      }
      return BigInt(value);
    }

    if (typeof value === 'number' && Number.isInteger(value)) {
      this.validateSafeIntegerRange(value, fieldName);
      return BigInt(value);
    }

    throw new Error(
      `Invalid int64 value for field '${fieldName}'. Expected BigInt, Long object, string, or safe integer`
    );
  }

  /**
   * Convert various types to number with validation
   */
  private convertToNumber(value: any, fieldName: string): number {
    if (typeof value === 'number' && Number.isInteger(value)) {
      this.validateSafeIntegerRange(value, fieldName);
      return value;
    }

    if (typeof value === 'bigint') {
      if (
        value >= BigInt(Number.MIN_SAFE_INTEGER) &&
        value <= BigInt(Number.MAX_SAFE_INTEGER)
      ) {
        return Number(value);
      }
      throw new Error(
        `BigInt value ${value} is outside safe integer range for number strategy`
      );
    }

    // Check if it's a Long object (from 'long' library)
    if (
      value !== null &&
      typeof value === 'object' &&
      'low' in value &&
      'high' in value &&
      'unsigned' in value
    ) {
      const longValue = (value as any).toNumber();
      this.validateSafeIntegerRange(longValue, fieldName);
      return longValue;
    }

    if (typeof value === 'string' && /^-?\d+$/.test(value)) {
      const numValue = Number(value);
      this.validateSafeIntegerRange(numValue, fieldName);
      return numValue;
    }

    throw new Error(
      `Invalid int64 value for field '${fieldName}'. Expected number, BigInt, Long object, or valid integer string`
    );
  }

  /**
   * Validate int64 as number (only safe integers)
   */
  private validateInt64AsNumber(
    value: any,
    fieldName: string
  ): { value: any; size: number } {
    const numValue = this.convertToNumber(value, fieldName);
    // Convert to string for JSON output
    return { value: numValue.toString(), size: 8 };
  }

  /**
   * Validate int64 as BigInt (preserves full precision)
   */
  private validateInt64AsBigInt(
    value: any,
    fieldName: string
  ): { value: any; size: number } {
    const bigIntValue = this.convertToBigInt(value, fieldName);
    this.validateInt64Range(bigIntValue, fieldName);
    // Convert to string for JSON output
    return { value: bigIntValue.toString(), size: 8 };
  }

  /**
   * Auto-validate int64 (smart detection)
   */
  private validateInt64Auto(
    value: any,
    fieldName: string
  ): { value: any; size: number } {
    // Always convert to string for JSON output
    if (typeof value === 'bigint') {
      this.validateInt64Range(value, fieldName);
      return { value: value.toString(), size: 8 };
    }

    // If it's a Long object, convert to string
    if (
      value !== null &&
      typeof value === 'object' &&
      'low' in value &&
      'high' in value &&
      'unsigned' in value
    ) {
      return { value: value.toString(), size: 8 };
    }

    // If it's a string, validate and keep as string for precision
    if (typeof value === 'string') {
      if (!/^-?\d+$/.test(value)) {
        throw new Error(
          `Invalid int64 string format for field '${fieldName}': ${value}`
        );
      }
      const bigIntValue = BigInt(value);
      this.validateInt64Range(bigIntValue, fieldName);
      return { value, size: 8 };
    }

    // If it's a number, convert to string
    if (typeof value === 'number' && Number.isInteger(value)) {
      if (value < Number.MIN_SAFE_INTEGER || value > Number.MAX_SAFE_INTEGER) {
        // Convert to string to preserve precision
        return { value: value.toString(), size: 8 };
      }
      return { value: value.toString(), size: 8 };
    }

    throw new Error(
      `Invalid int64 value for field '${fieldName}'. Expected BigInt, Long object, string, or safe integer`
    );
  }

  /**
   * Validate int64 array (special handling for int64 elements)
   */
  validateInt64Array(
    value: any[],
    fieldName: string,
    maxCapacity: number
  ): { value: any[]; size: number } {
    const validatedValues: any[] = [];
    let totalSize = 0;

    for (const item of value) {
      const validationResult = this.validateInt64Field(item, fieldName);
      validatedValues.push(validationResult.value);
      totalSize += validationResult.size;
    }

    return { value: validatedValues, size: totalSize };
  }
}
