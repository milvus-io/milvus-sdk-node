import { DataType, MetricType } from '..';

export const buildSchema = (data: {
  dimension: number;
  primary_field_name: string;
  id_type: DataType.Int64 | DataType.VarChar;
  vector_field_name: string;
}) => {
  return [
    {
      name: data.primary_field_name,
      data_type: data.id_type,
      is_primary_key: true,
      autoID: false,
    },
    {
      name: data.vector_field_name,
      data_type: DataType.FloatVector,
      dim: data.dimension,
    },
  ];
};

export const getDefaultIndexParams = () => ({
  index_type: 'HNSW',
  metric_type: MetricType.IP,
  params: { efConstruction: 8, M: 64 },
});
