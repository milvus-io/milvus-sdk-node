import {
  parseBufferToSparseRow,
  parseSparseRowsToBytes,
  SparseFloatVector,
  parseSparseVectorToBytes,
} from '../../milvus';

describe('Sparse rows <-> Bytes conversion', () => {
  it('should throw error if index is negative or exceeds 2^32-1', () => {
    const invalidIndexData = {
      0: 1.5,
      4294967296: 2.7, // 2^32
    };
    expect(() => parseSparseVectorToBytes(invalidIndexData)).toThrow();
  });

  it('should throw error if value is NaN', () => {
    const invalidValueData = {
      0: 1.5,
      3: NaN,
    };
    expect(() => parseSparseVectorToBytes(invalidValueData)).toThrow();
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
});
