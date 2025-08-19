export function validateInt8Vector(
  x: unknown,
  field: any
): { value: Int8Array; size: number } {
  const dim = Number(field.dim) || 0;
  let arr: number[] | Int8Array;

  if (x instanceof Int8Array || x instanceof Uint8Array) {
    arr = Array.from(new Int8Array(x));
  } else if (Array.isArray(x)) {
    arr = x;
  } else {
    throw new Error(
      `Invalid int8 vector: expected Int8Array | Uint8Array | number[]`
    );
  }

  if (arr.length !== dim) {
    throw new Error(
      `Invalid int8 vector length: expected ${dim}, got ${arr.length}`
    );
  }

  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (!Number.isInteger(v) || v < -128 || v > 127) {
      throw new Error(
        `Invalid int8 vector element at index ${i}: expected -128..127, got ${v}`
      );
    }
  }

  // Convert to Int8Array for proper serialization and return unified format
  const int8Array = new Int8Array(arr);
  return { value: int8Array, size: dim };
}
