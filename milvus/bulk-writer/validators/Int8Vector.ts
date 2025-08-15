export function validateInt8Vector(x: unknown, dim: number): number[] {
  // Handle Int8Array input
  if (x instanceof Int8Array) {
    if (x.length !== dim) {
      throw new Error(
        `Invalid int8 vector bytes: expected length ${dim}, got ${x.length}`
      );
    }
    return Array.from(x);
  }

  // Handle array input
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
