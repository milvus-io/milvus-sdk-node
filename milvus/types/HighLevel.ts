import {
  DataType,
  MetricType,
  CreateIndexParam,
  collectionNameReq,
  CreateCollectionReq,
  CreateIndexSimpleReq,
  BaseCreateCollectionReq,
} from '../';

// highlevel，only collection_name and dimension are required
export interface CreateColReq extends collectionNameReq {
  dimension: number;
  primary_field_name?: string;
  id_type?: DataType.Int64 | DataType.VarChar;
  vector_field_name?: string;
  metric_type?: string | MetricType;
  timeout?: number;
  enable_dynamic_field?: boolean;
  enableDynamicField?: boolean;
  description?: string;
  auto_id?: boolean;
  timeouts?: number;
  consistency_level?:
    | 'Strong'
    | 'Session'
    | 'Bounded'
    | 'Eventually'
    | 'Customized';
  index_params?: CreateIndexParam;
}

export type CreateColWithSchemaReq = CreateCollectionReq & {
  index_params: Omit<CreateIndexSimpleReq, 'collection_name'>[];
};
