import { Root } from 'protobufjs';
import { Float16Array } from '@petamoriken/float16';
import {
  FloatVector,
  BinaryVector,
  SparseFloatVector,
  DataType,
  SearchMultipleDataType,
  Float16Vector,
  SparseVectorCSR,
  SparseVectorCOO,
  BFloat16Vector,
  SparseVectorArray,
  FieldSchema,
} from '..';

/**
 * Converts a float vector into bytes format.
 *
 * @param {FloatVector} array - The float vector to convert.
 * @returns {Buffer} Bytes representing the float vector.
 */
export const f32ArrayToF32Bytes = (array: FloatVector) => {
  // create array buffer
  const a = new Float32Array(array);
  // need return bytes to milvus proto
  return Buffer.from(a.buffer);
};

/**
 * Converts a binary vector into bytes format.
 *
 * @param {BinaryVector} array - The binary vector to convert.
 * @returns {Buffer} Bytes representing the binary vector.
 */
export const f32ArrayToBinaryBytes = (array: BinaryVector) => {
  const a = new Uint8Array(array);
  // need return bytes to milvus proto
  return Buffer.from(a.buffer);
};

/**
 * Converts a float16 vector into bytes format.
 *
 * @param {Float16Vector} array - The float16 vector(f32 format) to convert.
 * @returns {Buffer} Bytes representing the float16 vector.
 */
export const f32ArrayToF16Bytes = (array: Float16Vector) => {
  const float16Bytes = new Float16Array(array);
  return Buffer.from(float16Bytes.buffer);
};

/**
 * Convert float16 bytes to float32 array.
 * @param {Uint8Array} f16Bytes - The float16 bytes to convert.
 * @returns {Array} The float32 array.
 */
export const f16BytesToF32Array = (f16Bytes: Uint8Array) => {
  const buffer = new ArrayBuffer(f16Bytes.length);
  const view = new Uint8Array(buffer);
  view.set(f16Bytes);

  const f16Array = new Float16Array(buffer);
  return Array.from(f16Array);
};

/**
 *  Convert float32 array to BFloat16 bytes, not a real conversion, just take the last 2 bytes of float32.
 * @param {BFloat16Vector} array - The float32 array to convert.
 * @returns {Buffer} The BFloat16 bytes.
 */
export const f32ArrayToBf16Bytes = (array: BFloat16Vector) => {
  const totalBytesNeeded = array.length * 2; // 2 bytes per float32
  const buffer = new ArrayBuffer(totalBytesNeeded);
  const bfloatView = new Uint8Array(buffer);

  let byteIndex = 0;
  array.forEach(float32 => {
    const floatBuffer = new ArrayBuffer(4);
    const floatView = new Float32Array(floatBuffer);
    const bfloatViewSingle = new Uint8Array(floatBuffer);

    floatView[0] = float32;
    bfloatView.set(bfloatViewSingle.subarray(2, 4), byteIndex);
    byteIndex += 2;
  });

  return Buffer.from(bfloatView);
};

/**
 * Convert BFloat16 bytes to Float32 array.
 * @param {Uint8Array} bf16Bytes - The BFloat16 bytes to convert.
 * @returns {Array} The Float32 array.
 */
export const bf16BytesToF32Array = (bf16Bytes: Uint8Array) => {
  const float32Array: number[] = [];
  const totalFloats = bf16Bytes.length / 2;

  for (let i = 0; i < totalFloats; i++) {
    const floatBuffer = new ArrayBuffer(4);
    const floatView = new Float32Array(floatBuffer);
    const bfloatView = new Uint8Array(floatBuffer);

    bfloatView.set(bf16Bytes.subarray(i * 2, i * 2 + 2), 2);
    float32Array.push(floatView[0]);
  }

  return float32Array;
};

/**
 * Get SparseVector type.
 * @param {SparseFloatVector} vector - The sparse float vector to convert.
 *
 * @returns string, 'array' | 'coo' | 'csr' | 'dict'
 */
export const getSparseFloatVectorType = (
  vector: SparseFloatVector
): 'array' | 'coo' | 'csr' | 'dict' | 'unknown' => {
  if (Array.isArray(vector)) {
    if (vector.length === 0) {
      return 'array';
    }
    if (typeof vector[0] === 'number' || typeof vector[0] === 'undefined') {
      return 'array';
    } else if (
      (vector as SparseVectorCOO).every(
        item => typeof item === 'object' && 'index' in item && 'value' in item
      )
    ) {
      return 'coo';
    } else {
      return 'unknown';
    }
  } else if (
    typeof vector === 'object' &&
    'indices' in vector &&
    'values' in vector
  ) {
    return 'csr';
  } else if (
    typeof vector === 'object' &&
    Object.keys(vector).every(key => typeof vector[key] === 'number')
  ) {
    return 'dict';
  } else {
    return 'unknown';
  }
};

/**
 * Converts a sparse float vector into bytes format.
 *
 * @param {SparseFloatVector} data - The sparse float vector to convert, support 'array' | 'coo' | 'csr' | 'dict'.
 *
 * @returns {Uint8Array} Bytes representing the sparse float vector.
 * @throws {Error} If the length of indices and values is not the same, or if the index is not within the valid range, or if the value is NaN.
 */
export const sparseToBytes = (data: SparseFloatVector): Uint8Array => {
  // detect the format of the sparse vector
  const type = getSparseFloatVectorType(data);

  let indices: number[] = [];
  let values: number[] = [];

  switch (type) {
    case 'array':
      for (let i = 0; i < (data as SparseVectorArray).length; i++) {
        const element = (data as SparseVectorArray)[i];
        if (element !== undefined && !isNaN(element)) {
          indices.push(i);
          values.push(element);
        }
      }
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
export const sparseRowsToBytes = (data: SparseFloatVector[]): Uint8Array[] => {
  const result: Uint8Array[] = [];
  for (const row of data) {
    result.push(sparseToBytes(row));
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
export const bytesToSparseRow = (bufferData: Buffer): SparseFloatVector => {
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
 * @param {SearchMultipleDataType[]} data - An array of search vectors.
 * @param {DataType} vectorDataType - The data type of the vectors.
 *
 * @returns {Uint8Array} The placeholder group in bytes format.
 */
export const buildPlaceholderGroupBytes = (
  milvusProto: Root,
  data: SearchMultipleDataType,
  field: FieldSchema
) => {
  const { dataType, is_function_output } = field;
  // create placeholder_group value
  let bytes;

  if (is_function_output) {
    // parse text to bytes
    bytes = data.map(d => new TextEncoder().encode(String(d)));
  } else {
    // parse vectors to bytes
    switch (dataType) {
      case DataType.FloatVector:
        bytes = data.map(v => f32ArrayToF32Bytes(v as FloatVector));
        break;
      case DataType.BinaryVector:
        bytes = data.map(v => f32ArrayToBinaryBytes(v as BinaryVector));
        break;
      case DataType.BFloat16Vector:
        bytes = data.map(v =>
          Array.isArray(v) ? f32ArrayToBf16Bytes(v as BFloat16Vector) : v
        );
        break;
      case DataType.Float16Vector:
        bytes = data.map(v =>
          Array.isArray(v) ? f32ArrayToF16Bytes(v as Float16Vector) : v
        );
        break;
      case DataType.SparseFloatVector:
        bytes = data.map(v => sparseToBytes(v as SparseFloatVector));

        break;
    }
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
          type: is_function_output ? DataType.VarChar : dataType,
          values: bytes,
        },
      ],
    })
  ).finish();

  return placeholderGroupBytes;
};
