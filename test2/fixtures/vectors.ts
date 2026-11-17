import {
  DataType,
  SearchVector,
  IndexType,
  MetricType,
  f32ArrayToF16Bytes,
  f32ArrayToBf16Bytes,
} from '../../milvus';

export interface VectorCase {
  name: string;
  type: DataType;
  dim: number;
  index: IndexType;
  metric: MetricType;
  input: (row: number) => SearchVector;
  expected: (row: number) => number[] | Record<string, number>;
  precision?: number;
}
const floats = (row: number, dimension = 8) =>
  Array.from({ length: dimension }, (_, i) => (row + (i + 1) / 137) / 4);
const int8 = (row: number) => [
  -128 + row,
  -8 + row,
  row,
  127 - row,
  0,
  1,
  -1,
  64,
];
const binary = (row: number) =>
  [
    [0x00, 0xff],
    [0xaa, 0x55],
    [0x12, 0x34],
  ][row];
const sparse = (row: number) => ({ 1: row + 1, 3: 0.25 });
const dense = { dim: 8, index: IndexType.FLAT, metric: MetricType.L2 };
const sparseIndex = {
  type: DataType.SparseFloatVector,
  dim: 8,
  index: IndexType.SPARSE_WAND,
  metric: MetricType.IP,
  expected: sparse,
};

export const vectorCases: VectorCase[] = [
  {
    ...dense,
    name: 'float32/array',
    type: DataType.FloatVector,
    input: floats,
    expected: floats,
    precision: 6,
  },
  ...([DataType.Float16Vector, DataType.BFloat16Vector] as const).flatMap(
    type => {
      const values = (row: number) =>
        floats(row, type === DataType.Float16Vector ? 128 : 8);
      const dimensions = type === DataType.Float16Vector ? 128 : 8;
      const encode =
        type === DataType.Float16Vector
          ? f32ArrayToF16Bytes
          : f32ArrayToBf16Bytes;
      return [
        {
          ...dense,
          dim: dimensions,
          name: `${DataType[type]}/array`,
          type,
          input: values,
          expected: values,
          precision: type === DataType.Float16Vector ? 3 : 2,
        },
        {
          ...dense,
          dim: dimensions,
          name: `${DataType[type]}/bytes`,
          type,
          input: (row: number) => encode(values(row)),
          expected: values,
          precision: type === DataType.Float16Vector ? 3 : 2,
        },
      ];
    }
  ),
  {
    name: 'binary/array',
    type: DataType.BinaryVector,
    dim: 16,
    index: IndexType.BIN_IVF_FLAT,
    metric: MetricType.HAMMING,
    input: binary,
    expected: binary,
  },
  {
    name: 'binary/bytes',
    type: DataType.BinaryVector,
    dim: 16,
    index: IndexType.BIN_IVF_FLAT,
    metric: MetricType.HAMMING,
    input: row => Uint8Array.from(binary(row)),
    expected: binary,
  },
  {
    name: 'int8/array',
    type: DataType.Int8Vector,
    dim: 8,
    index: IndexType.HNSW,
    metric: MetricType.L2,
    input: int8,
    expected: int8,
  },
  {
    name: 'int8/typed-array',
    type: DataType.Int8Vector,
    dim: 8,
    index: IndexType.HNSW,
    metric: MetricType.L2,
    input: row => Int8Array.from(int8(row)),
    expected: int8,
  },
  { ...sparseIndex, name: 'sparse/dictionary', input: sparse },
  {
    ...sparseIndex,
    name: 'sparse/array',
    input: row => [undefined, row + 1, undefined, 0.25],
  },
  {
    ...sparseIndex,
    name: 'sparse/CSR',
    input: row => ({ indices: [1, 3], values: [row + 1, 0.25] }),
  },
  {
    ...sparseIndex,
    name: 'sparse/COO',
    input: row => [
      { index: 1, value: row + 1 },
      { index: 3, value: 0.25 },
    ],
  },
];
