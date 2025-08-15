export * from './FloatVector';
export * from './BinaryVector';
export * from './Int8Vector';
export * from './Int64';
export * from './SparseFloatVector';
export * from './Float16Vector';
export * from './BFloat16Vector';

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
