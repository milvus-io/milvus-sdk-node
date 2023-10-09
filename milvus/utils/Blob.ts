import { FloatVectors, BinaryVectors } from '../';

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
