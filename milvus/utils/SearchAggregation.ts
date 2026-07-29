import {
  AggregationBucket,
  AggregationDirection,
  AggregationHit,
  AggregationMetricOp,
  AggregationValue,
  SearchAggregation,
  SearchAggregationSpec,
} from '../types/SearchAggregation';
import { SearchRes } from '../types/Search';

const VALID_METRIC_OPS: AggregationMetricOp[] = [
  'avg',
  'sum',
  'count',
  'min',
  'max',
];
const VALID_DIRECTIONS: AggregationDirection[] = ['asc', 'desc'];
const SPECIAL_ORDER_KEYS = ['_count', '_key'];
const MAX_AGGREGATION_DEPTH = 4;

const isObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

/** Validate and clone a search aggregation into the protobuf request shape. */
export const buildSearchAggregation = (
  aggregation: SearchAggregation,
  depth = 1
): SearchAggregationSpec => {
  if (!isObject(aggregation)) {
    throw new Error('search_aggregation must be an object');
  }
  if (depth > MAX_AGGREGATION_DEPTH) {
    throw new Error(
      `search_aggregation supports at most ${MAX_AGGREGATION_DEPTH} levels`
    );
  }
  if (!Array.isArray(aggregation.fields) || aggregation.fields.length === 0) {
    throw new Error(
      'search_aggregation.fields must be a non-empty array of strings'
    );
  }
  aggregation.fields.forEach(field => {
    if (typeof field !== 'string' || field.trim().length === 0) {
      throw new Error(
        'search_aggregation.fields must contain non-empty strings'
      );
    }
    if (field.includes('[') || field.includes(']')) {
      throw new Error(
        'search_aggregation.fields does not support bracketed JSON paths'
      );
    }
  });
  if (!isPositiveInteger(aggregation.size)) {
    throw new Error('search_aggregation.size must be a positive integer');
  }

  const metrics = aggregation.metrics === undefined ? {} : aggregation.metrics;
  if (!isObject(metrics)) {
    throw new Error('search_aggregation.metrics must be an object');
  }
  Object.entries(metrics).forEach(([alias, metric]) => {
    if (!alias.trim()) {
      throw new Error('search_aggregation metric aliases must be non-empty');
    }
    if (!isObject(metric)) {
      throw new Error(`search_aggregation.metrics.${alias} must be an object`);
    }
    if (!VALID_METRIC_OPS.includes(metric.op)) {
      throw new Error(
        `search_aggregation.metrics.${alias}.op must be one of ${VALID_METRIC_OPS.join(
          ', '
        )}`
      );
    }
    if (typeof metric.field_name !== 'string' || !metric.field_name.trim()) {
      throw new Error(
        `search_aggregation.metrics.${alias}.field_name must be non-empty`
      );
    }
    if (metric.field_name === '*' && metric.op !== 'count') {
      throw new Error("'*' is only valid for the count metric");
    }
  });

  const order = aggregation.order === undefined ? [] : aggregation.order;
  if (!Array.isArray(order)) {
    throw new Error('search_aggregation.order must be an array');
  }
  const allowedOrderKeys = [...Object.keys(metrics), ...SPECIAL_ORDER_KEYS];
  order.forEach(item => {
    if (!isObject(item) || typeof item.key !== 'string' || !item.key.trim()) {
      throw new Error('search_aggregation.order.key must be non-empty');
    }
    if (!allowedOrderKeys.includes(item.key)) {
      throw new Error(
        'search_aggregation.order.key must be a metric alias, _count, or _key'
      );
    }
    if (!VALID_DIRECTIONS.includes(item.direction)) {
      throw new Error(
        "search_aggregation.order.direction must be 'asc' or 'desc'"
      );
    }
  });

  let topHits: SearchAggregationSpec['top_hits'];
  if (aggregation.top_hits !== undefined) {
    if (!isObject(aggregation.top_hits)) {
      throw new Error('search_aggregation.top_hits must be an object');
    }
    if (!isPositiveInteger(aggregation.top_hits.size)) {
      throw new Error(
        'search_aggregation.top_hits.size must be a positive integer'
      );
    }
    const sort =
      aggregation.top_hits.sort === undefined ? [] : aggregation.top_hits.sort;
    if (!Array.isArray(sort)) {
      throw new Error('search_aggregation.top_hits.sort must be an array');
    }
    sort.forEach(item => {
      if (
        !isObject(item) ||
        typeof item.field_name !== 'string' ||
        !item.field_name.trim()
      ) {
        throw new Error(
          'search_aggregation.top_hits.sort.field_name must be non-empty'
        );
      }
      if (!VALID_DIRECTIONS.includes(item.direction)) {
        throw new Error(
          "search_aggregation.top_hits.sort.direction must be 'asc' or 'desc'"
        );
      }
    });
    topHits = {
      size: aggregation.top_hits.size,
      sort: sort.map(item => ({ ...item })),
    };
  }

  const metricSpecs = Object.entries(metrics).reduce<
    SearchAggregationSpec['metrics']
  >((result, [alias, metric]) => {
    result[alias] = { op: metric.op, field_name: metric.field_name };
    return result;
  }, {});

  return {
    fields: [...aggregation.fields],
    size: aggregation.size,
    metrics: metricSpecs,
    order: order.map(item => ({ ...item })),
    ...(topHits ? { top_hits: topHits } : {}),
    ...(aggregation.sub_aggregation !== undefined
      ? {
          sub_aggregation: buildSearchAggregation(
            aggregation.sub_aggregation,
            depth + 1
          ),
        }
      : {}),
  };
};

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const readOneof = (
  value: Record<string, any>,
  discriminator: string,
  fields: string[]
): AggregationValue | undefined => {
  const selected = value[discriminator];
  if (typeof selected === 'string' && hasOwn(value, selected)) {
    return value[selected];
  }

  for (const field of fields) {
    if (hasOwn(value, field)) {
      return value[field];
    }
  }

  return undefined;
};

const parseAggregationHit = (
  hit: SearchRes['results']['agg_buckets'][number]['hits'][number],
  primaryFieldName: string
): AggregationHit => {
  const result: AggregationHit = { score: hit.score };
  const primaryKey = readOneof(hit, 'pk', ['int_pk', 'str_pk']);
  if (primaryKey !== undefined) {
    result[primaryFieldName] = primaryKey;
  }

  hit.fields.forEach(field => {
    const value = readOneof(field, 'value', [
      'int_val',
      'bool_val',
      'float_val',
      'double_val',
      'string_val',
      'bytes_val',
    ]);
    if (value === undefined) {
      return;
    }

    const fieldName = field.field_name || String(field.field_id);
    result[fieldName] = value;
  });

  return result;
};

const parseAggregationBucket = (
  bucket: SearchRes['results']['agg_buckets'][number],
  primaryFieldName: string
): AggregationBucket => {
  const metrics = Object.entries(bucket.metrics || {}).reduce<
    AggregationBucket['metrics']
  >((result, [alias, metric]) => {
    result[alias] = readOneof(metric, 'value', [
      'int_val',
      'double_val',
      'string_val',
      'bool_val',
    ]);
    return result;
  }, {});

  return {
    key: (bucket.key || []).map(entry => ({
      field_id: entry.field_id,
      field_name: entry.field_name || String(entry.field_id),
      value: readOneof(entry, 'value', ['int_val', 'string_val', 'bool_val']),
    })),
    count: bucket.count,
    metrics,
    hits: (bucket.hits || []).map(hit =>
      parseAggregationHit(hit, primaryFieldName)
    ),
    sub_groups: (bucket.sub_groups || []).map(subGroup =>
      parseAggregationBucket(subGroup, primaryFieldName)
    ),
  };
};

/** Parse and split search aggregation buckets by query vector. */
export const formatSearchAggregationResult = (
  searchRes: SearchRes
): AggregationBucket[][] => {
  const protoBuckets = searchRes.results.agg_buckets || [];
  if (protoBuckets.length === 0) {
    return [];
  }

  const primaryFieldName = searchRes.results.primary_field_name || 'id';
  const buckets = protoBuckets.map(bucket =>
    parseAggregationBucket(bucket, primaryFieldName)
  );
  const aggTopks = searchRes.results.agg_topks || [];

  if (aggTopks.length === 0) {
    if (Number(searchRes.results.num_queries) > 1) {
      return Array.from(
        { length: Number(searchRes.results.num_queries) },
        () => []
      );
    }
    return [buckets];
  }

  const result: AggregationBucket[][] = [];
  let offset = 0;
  aggTopks.forEach(value => {
    const bucketCount = Number(value);
    result.push(buckets.slice(offset, offset + bucketCount));
    offset += bucketCount;
  });

  if (offset < buckets.length) {
    result[result.length - 1].push(...buckets.slice(offset));
  }

  return result;
};
