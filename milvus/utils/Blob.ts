export const parseFloatArrayToBytes = (array: number[]) => {
  // create array buffer
  const a = new Float32Array(array);
  // need return bytes to milvus proto
  return Buffer.from(a.buffer);
};
