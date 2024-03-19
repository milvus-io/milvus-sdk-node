import { FloatVectors, BinaryVectors, SparseFloatVectors } from '../';

export const parseFloatVectorToBytes = (array: FloatVectors) => {
  // create array buffer
  const a = new Float32Array(array);
  // need return bytes to milvus proto
  return Buffer.from(a.buffer);
};

export const parseBinaryVectorToBytes = (array: BinaryVectors) => {
  // create array buffer
  const a = new Uint8Array(array);
  // need return bytes to milvus proto
  return Buffer.from(a.buffer);
};

export const parsesparseRowsToBytes = (
  data: SparseFloatVectors
): Uint8Array[] => {
  function sparseFloatRowToBytes(
    indices: number[],
    values: number[]
  ): Uint8Array {
    if (indices.length !== values.length) {
      throw new Error(
        `Length of indices and values must be the same, got ${indices.length} and ${values.length}`
      );
    }
    const bytes = new Uint8Array(8 * indices.length);
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const value = values[i];
      if (!(index >= 0 && index < Math.pow(2, 32) - 1)) {
        throw new Error(
          `Sparse vector index must be positive and less than 2^32-1: ${index}`
        );
      }
      if (isNaN(value)) {
        throw new Error('Sparse vector value must not be NaN');
      }
      const indexBytes = new Uint32Array([index]);
      const valueBytes = new Float32Array([value]);
      bytes.set(new Uint8Array(indexBytes.buffer), i * 8);
      bytes.set(new Uint8Array(valueBytes.buffer), i * 8 + 4);
    }
    return bytes;
  }

  const result: Uint8Array[] = [];
  for (const row of data) {
    const indices = Object.keys(row).map(Number);
    const values = Object.values(row);
    result.push(sparseFloatRowToBytes(indices, values));
  }
  return result;
};
