export * from './FloatVector';
export * from './BinaryVector';
export * from './Int8Vector';
export * from './Int64';
export * from './SparseFloatVector';
export * from './Float16Vector';
export * from './BFloat16Vector';
export * from './Array';
export * from './JSON';

import { validateInt64Field, validateInt64Array } from './Int64';

export function validateVarchar(
  x: unknown,
  field: any
): { value: string; size: number } {
  const maxLength = Number(field.max_length) || 65535;
  if (typeof x !== 'string' || x.length > maxLength) {
    throw new Error(`Invalid varchar: expected string length <= ${maxLength}`);
  }
  return { value: x, size: x.length };
}

export function validateArray(
  x: unknown,
  field: any
): { value: any[]; size: number } {
  if (!Array.isArray(x)) {
    throw new Error(`Field '${field.name}' must be an array`);
  }

  const maxCapacity = Number(field.max_capacity) || 1000;
  const elementType = field.element_type;

  if (!elementType) {
    throw new Error(`Array field '${field.name}' must specify element_type`);
  }

  if (x.length > maxCapacity) {
    throw new Error(
      `Array field '${field.name}' exceeds max capacity: ${x.length} > ${maxCapacity}`
    );
  }

  // Special handling for int64 arrays
  if (elementType === 'Int64') {
    return validateInt64Array(x, field.name, maxCapacity);
  }

  // For other element types, return a copy to avoid reference issues
  return { value: [...x], size: x.length * 8 };
}

// Basic scalar type validators
export function validateBool(
  x: unknown,
  field: any
): { value: boolean; size: number } {
  if (typeof x !== 'boolean') {
    throw new Error('Invalid boolean value: expected boolean');
  }
  return { value: x, size: 1 };
}

export function validateInt8(
  x: unknown,
  field: any
): { value: number; size: number } {
  if (
    !Number.isInteger(x as number) ||
    (x as number) < -128 ||
    (x as number) > 127
  ) {
    throw new Error('Invalid int8 value: expected integer -128 to 127');
  }
  return { value: x as number, size: 1 };
}

export function validateInt16(
  x: unknown,
  field: any
): { value: number; size: number } {
  if (
    !Number.isInteger(x as number) ||
    (x as number) < -32768 ||
    (x as number) > 32767
  ) {
    throw new Error('Invalid int16 value: expected integer -32768 to 32767');
  }
  return { value: x as number, size: 2 };
}

export function validateInt32(
  x: unknown,
  field: any
): { value: number; size: number } {
  if (
    !Number.isInteger(x as number) ||
    (x as number) < -2147483648 ||
    (x as number) > 2147483647
  ) {
    throw new Error(
      'Invalid int32 value: expected integer -2147483648 to 2147483647'
    );
  }
  return { value: x as number, size: 4 };
}

export function validateInt64(
  x: unknown,
  field: any
): { value: any; size: number } {
  return validateInt64Field(x, field.name);
}

export function validateFloat(
  x: unknown,
  field: any
): { value: number; size: number } {
  if (typeof x !== 'number' || !Number.isFinite(x)) {
    throw new Error('Invalid float value: expected finite number');
  }
  return { value: x, size: 4 };
}

export function validateDouble(
  x: unknown,
  field: any
): { value: number; size: number } {
  if (typeof x !== 'number' || !Number.isFinite(x)) {
    throw new Error('Invalid double value: expected finite number');
  }
  return { value: x, size: 8 };
}
