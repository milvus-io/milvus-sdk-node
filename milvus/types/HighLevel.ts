import { DataType, MetricType, CreateIndexParam } from '../';

// highlevel，only collection_name and dimension are required
export interface CreateColReq {
  collection_name: string;
  dimension: number;
  primary_field_name?: string;
  id_type?: DataType.Int64 | DataType.VarChar;
  vector_field_name?: string;
  metric_type?: string | MetricType;
  timeout?: number;
  enableDynamicField?: boolean;
  description?: string;
  auto_id?: boolean;
  timeouts?: number;
  index_params?: CreateIndexParam;
}
