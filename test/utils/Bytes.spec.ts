import {
  bytesToSparseRow,
  sparseRowsToBytes,
  SparseFloatVector,
  sparseToBytes,
  getSparseFloatVectorType,
  f32ArrayToF16Bytes,
  f16BytesToF32Array,
  f32ArrayToBf16Bytes,
  bf16BytesToF32Array,
} from '../../milvus';

describe('Data <-> Bytes Test', () => {
  it('should throw error if index is negative or exceeds 2^32-1', () => {
    const invalidIndexData = {
      0: 1.5,
      4294967296: 2.7, // 2^32
    };
    expect(() => sparseToBytes(invalidIndexData)).toThrow();
  });

  it('should return empty Uint8Array if data is empty', () => {
    expect(sparseToBytes({})).toEqual(new Uint8Array(0));
  });

  it('Conversion is reversible', () => {
    const inputSparseRows = [
      { '12': 0.875, '17': 0.789, '19': 0.934 },
    ] as SparseFloatVector[];

    const bytesArray = sparseRowsToBytes(inputSparseRows);

    const outputSparseRow = bytesToSparseRow(Buffer.concat(bytesArray));

    const originKeys = Object.keys(inputSparseRows[0]);
    const originValues = Object.values(inputSparseRows[0]);
    const outputKeys = Object.keys(outputSparseRow);
    const outputValues = Object.values(outputSparseRow);

    expect(originKeys).toEqual(outputKeys);

    originValues.forEach((value, index) => {
      expect(value).toBeCloseTo(outputValues[index]);
    });
  });

  it('should return "array" if the input is an empty array', () => {
    const data: any[] = [];
    expect(getSparseFloatVectorType(data)).toEqual('array');
  });

  it('should return "dict" if the input is an object', () => {
    const data = { '12': 0.875, '17': 0.789, '19': 0.934 };
    expect(getSparseFloatVectorType(data)).toEqual('dict');
  });

  it('should return "csr" if the input is an object with "indices" and "values"', () => {
    const data = { indices: [12, 17, 19], values: [0.875, 0.789, 0.934] };
    expect(getSparseFloatVectorType(data)).toEqual('csr');
  });

  it('should return "array" if the input is an array', () => {
    const data = [0.875, 0.789, 0.934];
    expect(getSparseFloatVectorType(data)).toEqual('array');
  });

  it('should return "coo" if the input is an array of objects with "index" and "value"', () => {
    const data = [
      { index: 12, value: 0.875 },
      { index: 17, value: 0.789 },
      { index: 19, value: 0.934 },
    ];
    expect(getSparseFloatVectorType(data)).toEqual('coo');
  });

  it('should return "unknown" if the input is not recognized', () => {
    const data: any = 'invalid';
    expect(getSparseFloatVectorType(data)).toEqual('unknown');

    const data2: any = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    expect(getSparseFloatVectorType(data2)).toEqual('unknown');
  });

  it('should transform f16b -> f32 and f32 -> f16b successfully', () => {
    const data = [0.123456789, -0.987654321, 3.14159265];
    const f16Bytes = f32ArrayToF16Bytes(data);
    const f32Array = f16BytesToF32Array(f16Bytes);

    expect(f32Array.length).toEqual(data.length);
    for (let i = 0; i < data.length; i++) {
      expect(data[i]).toBeCloseTo(f32Array[i], 2);
    }
  });

  it('should transform bf16b -> f32 and f32 -> bf16b successfully', () => {
    const data = [0.123456789, -0.987654321, 3.14159265];
    const bf16Bytes = f32ArrayToBf16Bytes(data);
    const f32Array = bf16BytesToF32Array(bf16Bytes);

    expect(f32Array.length).toEqual(data.length);
    for (let i = 0; i < data.length; i++) {
      expect(data[i]).toBeCloseTo(f32Array[i], 2);
    }
  });
});
