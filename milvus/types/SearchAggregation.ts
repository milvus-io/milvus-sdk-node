export type AggregationDirection = 'asc' | 'desc';
export type AggregationMetricOp = 'avg' | 'sum' | 'count' | 'min' | 'max';

export interface SearchAggregationMetric {
  op: AggregationMetricOp;
  field_name: string;
}

export interface SearchAggregationOrder {
  key: string;
  direction: AggregationDirection;
}

export interface SearchAggregationSort {
  field_name: string;
  direction: AggregationDirection;
}

export interface SearchAggregationTopHits {
  size: number;
  sort?: SearchAggregationSort[];
}

/** Bucket aggregation configuration for a search request. */
export interface SearchAggregation {
  fields: string[];
  size: number;
  metrics?: Record<string, SearchAggregationMetric>;
  order?: SearchAggregationOrder[];
  top_hits?: SearchAggregationTopHits;
  sub_aggregation?: SearchAggregation;
}

export interface SearchAggregationSpec extends SearchAggregation {
  metrics: Record<string, SearchAggregationMetric>;
  order: SearchAggregationOrder[];
  top_hits?: SearchAggregationTopHits & { sort: SearchAggregationSort[] };
  sub_aggregation?: SearchAggregationSpec;
}

export type AggregationValue = string | number | boolean | Buffer;

export interface AggregationBucketKey {
  field_id: string | number;
  field_name: string;
  value?: AggregationValue;
}

export interface AggregationHit {
  [field_name: string]: AggregationValue | undefined;
  score: number;
}

export interface AggregationBucket {
  key: AggregationBucketKey[];
  count: string | number;
  metrics: Record<string, AggregationValue | undefined>;
  hits: AggregationHit[];
  sub_groups: AggregationBucket[];
}

export interface ProtoAggregationValue {
  value?: string;
  int_val?: string | number;
  double_val?: number;
  string_val?: string;
  bool_val?: boolean;
}

export interface ProtoAggregationHitField extends ProtoAggregationValue {
  field_id: string | number;
  field_name: string;
  float_val?: number;
  bytes_val?: Buffer;
}

export interface ProtoAggregationHit {
  pk?: string;
  int_pk?: string | number;
  str_pk?: string;
  score: number;
  fields: ProtoAggregationHitField[];
}

export interface ProtoAggregationBucket {
  key: (ProtoAggregationValue & {
    field_id: string | number;
    field_name: string;
  })[];
  count: string | number;
  metrics: Record<string, ProtoAggregationValue>;
  hits: ProtoAggregationHit[];
  sub_groups: ProtoAggregationBucket[];
}
