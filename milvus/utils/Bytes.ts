import { Root } from 'protobufjs';
import { Float16Array } from '@petamoriken/float16';
import {
  FloatVector,
  BinaryVector,
  SparseFloatVector,
  DataType,
  VectorTypes,
  Float16Vector,
  SparseVectorCSR,
  SparseVectorCOO,
} from '..';

/**
 * Converts a float vector into bytes format.
 *
 * @param {FloatVector} array - The float vector to convert.
 *
 * @returns {Buffer} Bytes representing the float vector.
 */
export const parseFloatVectorToBytes = (array: FloatVector) => {
  // create array buffer
  const a = new Float32Array(array);
  // need return bytes to milvus proto
  return Buffer.from(a.buffer);
};

/**
 * Converts a binary vector into bytes format.
 *
 * @param {BinaryVector} array - The binary vector to convert.
 *
 * @returns {Buffer} Bytes representing the binary vector.
 */
export const parseBinaryVectorToBytes = (array: BinaryVector) => {
  const a = new Uint8Array(array);
  // need return bytes to milvus proto
  return Buffer.from(a.buffer);
};

export const parseFloat16VectorToBytes = (f16Array: Float16Vector) => {
  const float16Bytes = new Float16Array(f16Array);
  return Buffer.from(float16Bytes.buffer);
};

export const parseBytesToFloat16Vector = (float16Bytes: Uint8Array) => {
  const buffer = new ArrayBuffer(float16Bytes.length);
  const view = new Uint8Array(buffer);
  view.set(float16Bytes);

  const float16Array = new Float16Array(buffer);
  return Array.from(float16Array);
};

/**
 * Converts a sparse float vector into bytes format.
 * @param {SparseFloatVector} vector - The sparse float vector to convert.
 *
 * @returns string, 'array' | 'coo' | 'csr' | 'dict'
 */
export const getSparseFloatVectorType = (vector: SparseFloatVector) => {
  if (Array.isArray(vector)) {
    if (typeof vector[0] === 'number' || typeof vector[0] === 'undefined') {
      return 'array';
    } else {
      return 'coo';
    }
  } else if ('indices' in vector && 'values' in vector) {
    return 'csr';
  } else {
    return 'dict';
  }
};

/**
 * Converts a sparse float vector into bytes format.
 *
 * @param {SparseFloatVector} data - The sparse float vector to convert.
 *
 * @returns {Uint8Array} Bytes representing the sparse float vector.
 * @throws {Error} If the length of indices and values is not the same, or if the index is not within the valid range, or if the value is NaN.
 */
export const parseSparseVectorToBytes = (
  data: SparseFloatVector
): Uint8Array => {
  // detect the format of the sparse vector
  const type = getSparseFloatVectorType(data);

  let indices: number[];
  let values: number[];

  switch (type) {
    case 'array':
      indices = Object.keys(data).map(Number);
      values = Object.values(data);
      break;
    case 'coo':
      indices = Object.values(
        (data as SparseVectorCOO).map((item: any) => item.index)
      );
      values = Object.values(
        (data as SparseVectorCOO).map((item: any) => item.value)
      );
      break;
    case 'csr':
      indices = (data as SparseVectorCSR).indices;
      values = (data as SparseVectorCSR).values;
      break;
    case 'dict':
      indices = Object.keys(data).map(Number);
      values = Object.values(data);
      break;
  }

  // create a buffer to store the bytes
  const bytes = new Uint8Array(8 * indices.length);

  // loop through the indices and values and add them to the buffer
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i];
    const value = values[i];
    if (!(index >= 0 && index < Math.pow(2, 32) - 1)) {
      throw new Error(
        `Sparse vector index must be positive and less than 2^32-1: ${index}`
      );
    }

    const indexBytes = new Uint32Array([index]);
    const valueBytes = new Float32Array([value]);
    bytes.set(new Uint8Array(indexBytes.buffer), i * 8);
    bytes.set(new Uint8Array(valueBytes.buffer), i * 8 + 4);
  }
  return bytes;
};

/**
 * Converts an array of sparse float vectors into an array of bytes format.
 *
 * @param {SparseFloatVector[]} data - The array of sparse float vectors to convert.
 *
 * @returns {Uint8Array[]} An array of bytes representing the sparse float vectors.
 */
export const parseSparseRowsToBytes = (
  data: SparseFloatVector[]
): Uint8Array[] => {
  const result: Uint8Array[] = [];
  for (const row of data) {
    result.push(parseSparseVectorToBytes(row));
  }
  return result;
};

/**
 * Parses the provided buffer data into a sparse row representation.
 *
 * @param {Buffer} bufferData - The buffer data to parse.
 *
 * @returns {SparseFloatVector} The parsed sparse float vectors.
 */
export const parseBufferToSparseRow = (
  bufferData: Buffer
): SparseFloatVector => {
  const result: SparseFloatVector = {};
  for (let i = 0; i < bufferData.length; i += 8) {
    const key: string = bufferData.readUInt32LE(i).toString();
    const value: number = bufferData.readFloatLE(i + 4);
    if (value) {
      result[key] = value;
    }
  }
  return result;
};

/**
 * This function builds a placeholder group in bytes format for Milvus.
 *
 * @param {Root} milvusProto - The root object of the Milvus protocol.
 * @param {VectorTypes[]} searchVectors - An array of search vectors.
 * @param {DataType} vectorDataType - The data type of the vectors.
 *
 * @returns {Uint8Array} The placeholder group in bytes format.
 */
export const buildPlaceholderGroupBytes = (
  milvusProto: Root,
  vectors: VectorTypes[],
  vectorDataType: DataType
) => {
  // create placeholder_group value
  let bytes;
  // parse vectors to bytes
  switch (vectorDataType) {
    case DataType.FloatVector:
      bytes = vectors.map(v => parseFloatVectorToBytes(v as FloatVector));
      break;
    case DataType.BinaryVector:
      bytes = vectors.map(v => parseBinaryVectorToBytes(v as BinaryVector));
      break;
    case DataType.Float16Vector:
    case DataType.BFloat16Vector:
      bytes = vectors.map(v => parseFloat16VectorToBytes(v as Float16Vector));
      break;
    case DataType.SparseFloatVector:
      bytes = vectors.map(v =>
        parseSparseVectorToBytes(v as SparseFloatVector)
      );

      break;
  }
  // create placeholder_group
  const PlaceholderGroup = milvusProto.lookupType(
    'milvus.proto.common.PlaceholderGroup'
  );
  // tag $0 is hard code in milvus, when dsltype is expr
  const placeholderGroupBytes = PlaceholderGroup.encode(
    PlaceholderGroup.create({
      placeholders: [
        {
          tag: '$0',
          type: vectorDataType,
          values: bytes,
        },
      ],
    })
  ).finish();

  return placeholderGroupBytes;
};
