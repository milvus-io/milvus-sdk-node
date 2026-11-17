import path from 'path';
import protobuf from 'protobufjs';
import {
  DataType,
  HighlightType,
  SearchAggregation,
  buildSearchAggregation,
  buildSearchRequest,
  formatSearchAggregationResult,
} from '../../milvus';

const collectionInfo = {
  status: { error_code: 'Success', reason: '' },
  collection_name: 'products',
  collectionID: '1',
  consistency_level: 'Session',
  schema: {
    name: 'products',
    fields: [
      {
        name: 'id',
        fieldID: '1',
        dataType: DataType.Int64,
        data_type: 'Int64',
        is_primary_key: true,
      },
      {
        name: 'vector',
        fieldID: '2',
        dataType: DataType.FloatVector,
        data_type: 'FloatVector',
        type_params: [{ key: 'dim', value: '2' }],
        index_params: [],
      },
    ],
  },
  anns_fields: {
    vector: {
      dataType: DataType.FloatVector,
      data_type: 'FloatVector',
      type_params: [{ key: 'dim', value: '2' }],
      index_params: [],
    },
  },
} as any;

const milvusProto = protobuf.loadSync(
  path.resolve(__dirname, '../../proto/proto/milvus.proto')
);

const basicAggregation = (): SearchAggregation => ({
  fields: ['category'],
  size: 3,
  metrics: {
    doc_count: { op: 'count', field_name: '*' },
  },
});

describe('SearchAggregation', () => {
  it('builds metrics, top hits, ordering, and nested aggregation', () => {
    const aggregation = buildSearchAggregation({
      fields: ['category'],
      size: 3,
      metrics: {
        doc_count: { op: 'count', field_name: '*' },
        min_price: { op: 'min', field_name: 'price' },
        max_price: { op: 'max', field_name: 'price' },
        total_price: { op: 'sum', field_name: 'price' },
        avg_rating: { op: 'avg', field_name: 'rating' },
      },
      order: [
        { key: 'avg_rating', direction: 'desc' },
        { key: '_count', direction: 'desc' },
        { key: '_key', direction: 'asc' },
      ],
      top_hits: {
        size: 2,
        sort: [
          { field_name: 'price', direction: 'asc' },
          { field_name: '_score', direction: 'desc' },
        ],
      },
      sub_aggregation: {
        fields: ['brand'],
        size: 2,
        metrics: {
          brand_count: { op: 'count', field_name: '*' },
        },
      },
    });

    expect(aggregation).toEqual({
      fields: ['category'],
      size: 3,
      metrics: {
        doc_count: { op: 'count', field_name: '*' },
        min_price: { op: 'min', field_name: 'price' },
        max_price: { op: 'max', field_name: 'price' },
        total_price: { op: 'sum', field_name: 'price' },
        avg_rating: { op: 'avg', field_name: 'rating' },
      },
      order: [
        { key: 'avg_rating', direction: 'desc' },
        { key: '_count', direction: 'desc' },
        { key: '_key', direction: 'asc' },
      ],
      top_hits: {
        size: 2,
        sort: [
          { field_name: 'price', direction: 'asc' },
          { field_name: '_score', direction: 'desc' },
        ],
      },
      sub_aggregation: {
        fields: ['brand'],
        size: 2,
        metrics: {
          brand_count: { op: 'count', field_name: '*' },
        },
        order: [],
      },
    });
  });

  it.each([
    null,
    {},
    { fields: [], size: 1 },
    { fields: [''], size: 1 },
    { fields: ['meta["region"]'], size: 1 },
    { fields: ['brand'], size: 0 },
    { fields: ['brand'], size: 1, metrics: null },
    {
      fields: ['brand'],
      size: 1,
      metrics: { ' ': { op: 'count', field_name: '*' } },
    },
    {
      fields: ['brand'],
      size: 1,
      metrics: { bad: null },
    },
    {
      fields: ['brand'],
      size: 1,
      metrics: { bad: { op: 'count', field_name: ' ' } },
    },
    {
      fields: ['brand'],
      size: 1,
      metrics: { bad: { op: 'median', field_name: 'price' } },
    },
    {
      fields: ['brand'],
      size: 1,
      metrics: { bad: { op: 'avg', field_name: '*' } },
    },
    { fields: ['brand'], size: 1, order: null },
    { fields: ['brand'], size: 1, order: [{}] },
    {
      fields: ['brand'],
      size: 1,
      order: [{ key: 'unknown', direction: 'asc' }],
    },
    {
      fields: ['brand'],
      size: 1,
      order: [{ key: '_key', direction: 'sideways' }],
    },
    { fields: ['brand'], size: 1, top_hits: null },
    {
      fields: ['brand'],
      size: 1,
      top_hits: { size: 0 },
    },
    {
      fields: ['brand'],
      size: 1,
      top_hits: { size: 1, sort: null },
    },
    {
      fields: ['brand'],
      size: 1,
      top_hits: { size: 1, sort: [{}] },
    },
    {
      fields: ['brand'],
      size: 1,
      top_hits: {
        size: 1,
        sort: [{ field_name: '_score', direction: 'sideways' }],
      },
    },
  ])('rejects invalid configurations', aggregation => {
    expect(() => buildSearchAggregation(aggregation as any)).toThrow();
  });

  it('rejects aggregation nesting deeper than four levels', () => {
    let aggregation: any = { fields: ['level_5'], size: 1 };
    for (let level = 4; level >= 1; level--) {
      aggregation = {
        fields: [`level_${level}`],
        size: 1,
        sub_aggregation: aggregation,
      };
    }

    expect(() => buildSearchAggregation(aggregation)).toThrow(
      'at most 4 levels'
    );
  });

  it('adds a plain aggregation object to a regular search request', () => {
    const searchAggregation = basicAggregation();
    const result = buildSearchRequest(
      {
        collection_name: 'products',
        data: [0.1, 0.2],
        search_aggregation: searchAggregation,
      },
      collectionInfo,
      milvusProto
    );

    expect(result.isHybridSearch).toBe(false);
    expect((result.request as any).search_aggregation).toEqual({
      ...searchAggregation,
      order: [],
    });
  });

  it.each([
    { group_by_field: 'brand', error: 'group_by_field' },
    { params: { group_by_field: 'brand' }, error: 'group_by_field' },
    { group_by_fields: ['brand'], error: 'group_by_fields' },
    { params: { group_by_fields: ['brand'] }, error: 'group_by_fields' },
    { offset: 1, error: 'offset' },
    { params: { offset: 1 }, error: 'offset' },
    {
      highlighter: { type: HighlightType.Lexical },
      error: 'highlighter',
    },
  ])('rejects incompatible search options: $error', option => {
    expect(() =>
      buildSearchRequest(
        {
          collection_name: 'products',
          data: [0.1, 0.2],
          search_aggregation: basicAggregation(),
          ...option,
        } as any,
        collectionInfo,
        milvusProto
      )
    ).toThrow(option.error);
  });

  it('rejects search aggregation in hybrid search', () => {
    expect(() =>
      buildSearchRequest(
        {
          collection_name: 'products',
          data: [{ anns_field: 'vector', data: [0.1, 0.2] }],
          search_aggregation: basicAggregation(),
        } as any,
        collectionInfo,
        milvusProto
      )
    ).toThrow('hybrid search');
  });

  it('parses typed metrics, top hits, and nested buckets', () => {
    const result = formatSearchAggregationResult({
      results: {
        num_queries: 1,
        agg_topks: ['1'],
        agg_buckets: [
          {
            key: [
              {
                field_id: '10',
                field_name: 'category',
                string_val: 'books',
                value: 'string_val',
              },
              {
                field_id: '11',
                field_name: 'featured',
                bool_val: false,
                value: 'bool_val',
              },
            ],
            count: '9007199254740993',
            metrics: {
              total: {
                int_val: '9007199254740995',
                value: 'int_val',
              },
              average: { double_val: 12.5, value: 'double_val' },
              label: { string_val: 'popular', value: 'string_val' },
              active: { bool_val: true, value: 'bool_val' },
            },
            hits: [
              {
                int_pk: '9007199254740997',
                pk: 'int_pk',
                score: 0.25,
                fields: [
                  {
                    field_id: '20',
                    field_name: 'price',
                    int_val: '99',
                    value: 'int_val',
                  },
                  {
                    field_id: '21',
                    field_name: 'rating',
                    double_val: 4.5,
                    value: 'double_val',
                  },
                ],
              },
            ],
            sub_groups: [
              {
                key: [
                  {
                    field_id: '30',
                    field_name: 'brand',
                    string_val: 'acme',
                    value: 'string_val',
                  },
                ],
                count: '1',
                metrics: {},
                hits: [],
                sub_groups: [],
              },
            ],
          },
        ],
      },
    } as any);

    const bucket = result[0][0];
    expect(bucket.key.map(entry => entry.value)).toEqual(['books', false]);
    expect(bucket.count).toBe('9007199254740993');
    expect(bucket.metrics).toEqual({
      total: '9007199254740995',
      average: 12.5,
      label: 'popular',
      active: true,
    });
    expect(bucket.hits[0]).toEqual({
      id: '9007199254740997',
      score: 0.25,
      price: '99',
      rating: 4.5,
    });
    expect(bucket.sub_groups[0].key[0].value).toBe('acme');
  });

  it('splits top-level buckets by agg_topks', () => {
    const bucket = (count: number) => ({
      key: [],
      count,
      metrics: {},
      hits: [],
      sub_groups: [],
    });
    const result = formatSearchAggregationResult({
      results: {
        num_queries: 3,
        agg_topks: ['2', '1', '3'],
        agg_buckets: [1, 2, 3, 4, 5, 6].map(bucket),
      },
    } as any);

    expect(result.map(buckets => buckets.map(item => item.count))).toEqual([
      [1, 2],
      [3],
      [4, 5, 6],
    ]);
  });

  it('handles protobuf oneofs without discriminators', () => {
    const result = formatSearchAggregationResult({
      results: {
        primary_field_name: 'product_id',
        num_queries: 1,
        agg_topks: [],
        agg_buckets: [
          {
            key: [
              { field_id: '10', field_name: '', int_val: '7' },
              { field_id: '11', field_name: 'missing' },
            ],
            count: '1',
            metrics: {
              count: { int_val: '1' },
              missing: {},
            },
            hits: [
              {
                str_pk: 'product-1',
                score: 0.5,
                fields: [
                  {
                    field_id: '20',
                    field_name: '',
                    string_val: 'value',
                  },
                  { field_id: '21', field_name: 'missing' },
                ],
              },
            ],
            sub_groups: [],
          },
        ],
      },
    } as any);

    expect(result[0][0]).toEqual({
      key: [
        { field_id: '10', field_name: '10', value: '7' },
        { field_id: '11', field_name: 'missing', value: undefined },
      ],
      count: '1',
      metrics: { count: '1', missing: undefined },
      hits: [{ product_id: 'product-1', score: 0.5, '20': 'value' }],
      sub_groups: [],
    });
  });

  it('returns empty buckets and appends unmatched trailing buckets', () => {
    expect(
      formatSearchAggregationResult({
        results: { num_queries: 1, agg_topks: [], agg_buckets: [] },
      } as any)
    ).toEqual([]);

    const result = formatSearchAggregationResult({
      results: {
        num_queries: 2,
        agg_topks: ['1', '0'],
        agg_buckets: [
          { key: [], count: 1, metrics: {}, hits: [], sub_groups: [] },
          { key: [], count: 2, metrics: {}, hits: [], sub_groups: [] },
        ],
      },
    } as any);

    expect(result.map(buckets => buckets.map(bucket => bucket.count))).toEqual([
      [1],
      [2],
    ]);
  });

  it('does not guess bucket ownership without agg_topks for multiple queries', () => {
    const result = formatSearchAggregationResult({
      results: {
        num_queries: 2,
        agg_topks: [],
        agg_buckets: [
          { key: [], count: 1, metrics: {}, hits: [], sub_groups: [] },
        ],
      },
    } as any);

    expect(result).toEqual([[], []]);
  });
});
