import { DataType } from '../';

// highlevel
export interface CreateColReq {
  collection_name: string;
  dimension: number;
  primary_field_name?: string;
  id_type?: DataType.Int64 | DataType.VarChar;
  vector_field_name?: string;
  metric_type?: string;
  timeout?: number;
  enableDynamicField?: boolean;
  description?: string;
  loadOnInit?: boolean;
}
