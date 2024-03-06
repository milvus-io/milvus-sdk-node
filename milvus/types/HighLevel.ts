import {
  DataType,
  MetricType,
  CreateIndexParam,
  collectionNameReq,
  CreateCollectionReq,
  CreateIndexSimpleReq,
} from '../';

// Create collection method1: only collection_name and dimension are required
export interface CreateColReq extends collectionNameReq {
  dimension: number; // required, dimension of the vector field
  primary_field_name?: string; // optional, primary field name, default is 'id'
  id_type?: DataType.Int64 | DataType.VarChar; // optional, primary field data type, default is 'Int64'
  vector_field_name?: string; // optional, vector field name,  default is 'embedding'
  metric_type?: string | MetricType; // optional, metric type to build index,  default is 'L2'
  enable_dynamic_field?: boolean; // optional, enable dynamic field, default is true
  enableDynamicField?: boolean; // optional, alias of enable_dynamic_field
  description?: string; // optional, description of the collection
  auto_id?: boolean; // optional, auto id, default is false
  consistency_level?:
    | 'Strong'
    | 'Session'
    | 'Bounded'
    | 'Eventually'
    | 'Customized'; // optional,consistency level, default is 'Bounded'
  index_params?: CreateIndexParam; // optional, index params
  timeout?: number; // optional, timeout for the request
}

//  Create collection method2: create collection with fields and index params, fields or schema and index_params are required
export type CreateColWithSchemaAndIndexParamsReq = CreateCollectionReq & {
  index_params: Omit<CreateIndexSimpleReq, 'collection_name'>[] | Omit<CreateIndexSimpleReq, 'collection_name'>; // required, index params
};
