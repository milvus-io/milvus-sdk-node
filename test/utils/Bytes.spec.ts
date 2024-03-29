import {
  parseBufferToSparseRow,
  parseSparseRowsToBytes,
  SparseFloatVector,
  parseSparseVectorToBytes,
  getSparseFloatVectorType,
} from '../../milvus';

describe('Sparse rows <-> Bytes conversion', () => {
  it('should throw error if index is negative or exceeds 2^32-1', () => {
    const invalidIndexData = {
      0: 1.5,
      4294967296: 2.7, // 2^32
    };
    expect(() => parseSparseVectorToBytes(invalidIndexData)).toThrow();
  });

  it('should return empty Uint8Array if data is empty', () => {
    expect(parseSparseVectorToBytes({})).toEqual(new Uint8Array(0));
  });

  it('Conversion is reversible', () => {
    const inputSparseRows = [
      { '12': 0.875, '17': 0.789, '19': 0.934 },
    ] as SparseFloatVector[];

    const bytesArray = parseSparseRowsToBytes(inputSparseRows);

    const outputSparseRow = parseBufferToSparseRow(Buffer.concat(bytesArray));

    const originKeys = Object.keys(inputSparseRows[0]);
    const originValues = Object.values(inputSparseRows[0]);
    const outputKeys = Object.keys(outputSparseRow);
    const outputValues = Object.values(outputSparseRow);

    expect(originKeys).toEqual(outputKeys);

    originValues.forEach((value, index) => {
      expect(value).toBeCloseTo(outputValues[index]);
    });
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
});
