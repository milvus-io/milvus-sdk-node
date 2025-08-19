export function validateFloatVector(
  x: unknown,
  field: any
): { value: number[]; size: number } {
  const dim = Number(field.dim) || 0;
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
  
  // Return unified format with value and size
  return { value: result, size: dim * 4 };
}
