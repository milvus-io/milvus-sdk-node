export const parseFloatVectorToBytes = (array: number[]) => {
  console.log(array);
  // create array buffer
  const a = new Float32Array(array);
  // need return bytes to milvus proto
  return Buffer.from(a.buffer);
};

export const parseBinaryVectorToBytes = (array: number[]) => {
  // create array buffer
  const a = new Uint8Array(array);
  // need return bytes to milvus proto
  return Buffer.from(a.buffer);
};
