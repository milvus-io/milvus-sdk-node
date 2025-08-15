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
