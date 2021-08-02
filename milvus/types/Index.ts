interface KeyValuePair {
  key: "index_type" | "metric_type" | "params";
  value: string;
}

export interface CreateIndexReq {
  collection_name: string;
  field_name: string;
  extra_params: KeyValuePair[];
}

export interface DescribeIndexReq {
  collection_name: string;
  field_name?: string;
}

export interface GetIndexStateReq {
  collection_name: string;
  field_name?: string;
}

export interface GetIndexBuildProgressReq {
  collection_name: string;
  field_name?: string;
  index_name: string;
}

export interface DropIndexReq {
  collection_name: string;
  field_name?: string;
}
