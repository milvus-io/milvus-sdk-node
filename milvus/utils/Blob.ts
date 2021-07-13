export const parseFloatArrayToBytes = (array: number[]) => {
  // create array buffer
  const a = new Float32Array(array);
  // need return bytes to milvus proto
  return Buffer.from(a.buffer);
};

export const parseUint8ArrayToBytes = (array: number[]) => {
  // create array buffer
  const a = new Uint8Array(array);
  // need return bytes to milvus proto
  return Buffer.from(a.buffer);
};
