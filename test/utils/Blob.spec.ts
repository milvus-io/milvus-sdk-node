import {
  parseBufferToSparseRow,
  parseSparseRowsToBytes,
  SparseFloatVectors,
} from '../../milvus';

describe('Sparse rows <-> Bytes conversion', () => {
  test('Conversion is reversible', () => {
    const inputSparseRows = [
      { '12': 0.875, '17': 0.789, '19': 0.934 },
    ] as SparseFloatVectors[];

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
