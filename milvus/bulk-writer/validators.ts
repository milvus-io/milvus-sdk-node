// Minimal validators aligned with pymilvus behavior. These are intended for
// client-side checks to fail fast before formatting/flushing.

export function validateFloatVector(x: unknown, dim: number): number[] {
  if (!Array.isArray(x) || x.length !== dim) {
    throw new Error(`Invalid float vector: expected array with dim=${dim}`);
  }
  const arr = x as unknown[];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`Invalid float vector element at ${i}`);
    }
  }
  return arr as number[];
}

export function validateBinaryVector(x: unknown, dim: number): number[] {
  // Binary vector is stored as bytes where 8 dim == 1 byte
  const byteLen = dim / 8;
  if (!Array.isArray(x) || x.length !== byteLen) {
    throw new Error(`Invalid binary vector: expected array with length=${byteLen}`);
  }
  const arr = x as unknown[];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (!Number.isInteger(v as number) || (v as number) < 0 || (v as number) > 255) {
      throw new Error(`Invalid binary vector element at ${i}`);
    }
  }
  return arr as number[];
}

export function validateInt8Vector(x: unknown, dim: number): number[] {
  if (!Array.isArray(x) || x.length !== dim) {
    throw new Error(`Invalid int8 vector: expected array with dim=${dim}`);
  }
  const arr = x as unknown[];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (!Number.isInteger(v as number) || (v as number) < -128 || (v as number) > 127) {
      throw new Error(`Invalid int8 vector element at ${i}`);
    }
  }
  return arr as number[];
}

export function validateVarchar(x: unknown, maxLength: number): string {
  if (typeof x !== 'string' || x.length > maxLength) {
    throw new Error(`Invalid varchar: expected string length <= ${maxLength}`);
  }
  return x;
}

export function validateJSON(x: unknown): boolean {
  return typeof x === 'string' || Array.isArray(x) || (!!x && typeof x === 'object');
}

export function validateArray(x: unknown, maxCapacity: number): unknown[] {
  if (!Array.isArray(x) || x.length > maxCapacity) {
    throw new Error(`Invalid array: expected array with length <= ${maxCapacity}`);
  }
  return x;
}


