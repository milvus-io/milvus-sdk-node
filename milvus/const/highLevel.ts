import { DataType } from './';

export const DEFAULT_HIGH_LEVEL_SCHEMA = (dimension: number) => [
  {
    name: 'id',
    data_type: DataType.Int64,
    is_primary_key: true,
    autoID: false,
  },
  {
    name: 'vector',
    data_type: DataType.FloatVector,
    dim: dimension,
  },
];

export const DEFAULT_HIGH_LEVEL_INDEX_PARAMS = (field_name: string) => ({
  field_name,
  index_type: 'HNSW',
  metric_type: 'L2',
  params: { efConstruction: 10, M: 4 },
});
