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
