import {
  AggregationBucket,
  DataType,
  ErrorCode,
  IndexType,
  MetricType,
  MilvusClient,
} from '../../milvus';
import { GENERATE_NAME, IP } from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
const COLLECTION_NAME = GENERATE_NAME('search_aggregation');

const rows = [
  {
    id: 1,
    vector: [1, 0],
    category: 'books',
    brand: 'acme',
    price: 10,
    rating: 4,
    in_stock: true,
  },
  {
    id: 2,
    vector: [0.99, 0.01],
    category: 'books',
    brand: 'acme',
    price: 20,
    rating: 5,
    in_stock: true,
  },
  {
    id: 3,
    vector: [0.98, 0.02],
    category: 'books',
    brand: 'zen',
    price: 30,
    rating: 3,
    in_stock: true,
  },
  {
    id: 4,
    vector: [0.97, 0.03],
    category: 'books',
    brand: 'zen',
    price: 40,
    rating: 4,
    in_stock: true,
  },
  {
    id: 5,
    vector: [0.96, 0.04],
    category: 'music',
    brand: 'acme',
    price: 50,
    rating: 2,
    in_stock: true,
  },
  {
    id: 6,
    vector: [0.95, 0.05],
    category: 'music',
    brand: 'acme',
    price: 60,
    rating: 3,
    in_stock: true,
  },
  {
    id: 7,
    vector: [0.94, 0.06],
    category: 'music',
    brand: 'zen',
    price: 70,
    rating: 4,
    in_stock: true,
  },
  {
    id: 8,
    vector: [0.93, 0.07],
    category: 'music',
    brand: 'zen',
    price: 80,
    rating: 5,
    in_stock: true,
  },
];

const keyValue = (bucket: any, fieldName: string) =>
  bucket.key.find((entry: any) => entry.field_name === fieldName)?.value;

describe('SearchAggregation API', () => {
  beforeAll(async () => {
    await milvusClient.createCollection({
      collection_name: COLLECTION_NAME,
      consistency_level: 'Strong',
      fields: [
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
        },
        {
          name: 'vector',
          data_type: DataType.FloatVector,
          dim: 2,
        },
        {
          name: 'category',
          data_type: DataType.VarChar,
          max_length: 32,
        },
        {
          name: 'brand',
          data_type: DataType.VarChar,
          max_length: 32,
        },
        {
          name: 'price',
          data_type: DataType.Int64,
        },
        {
          name: 'rating',
          data_type: DataType.Double,
        },
        {
          name: 'in_stock',
          data_type: DataType.Bool,
        },
      ],
    });

    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data: rows,
    });
    expect(insert.status.error_code).toBe(ErrorCode.SUCCESS);

    await milvusClient.flush({ collection_names: [COLLECTION_NAME] });
    await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'vector',
      index_type: IndexType.FLAT,
      metric_type: MetricType.L2,
    });
    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
  });

  afterAll(async () => {
    await milvusClient
      .releaseCollection({ collection_name: COLLECTION_NAME })
      .catch(() => undefined);
    await milvusClient
      .dropCollection({ collection_name: COLLECTION_NAME })
      .catch(() => undefined);
    await milvusClient.closeConnection();
  });

  it('returns bucket metrics, top hits, and nested aggregation per query', async () => {
    const result = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      anns_field: 'vector',
      data: [
        [1, 0],
        [0.9, 0.1],
      ],
      limit: rows.length,
      filter: 'in_stock == true',
      output_fields: ['category', 'brand', 'price', 'rating', 'in_stock'],
      search_aggregation: {
        fields: ['category'],
        size: 2,
        metrics: {
          doc_count: { op: 'count', field_name: '*' },
          min_price: { op: 'min', field_name: 'price' },
          max_price: { op: 'max', field_name: 'price' },
          total_price: { op: 'sum', field_name: 'price' },
          avg_price: { op: 'avg', field_name: 'price' },
        },
        order: [{ key: 'total_price', direction: 'desc' }],
        top_hits: {
          size: 2,
          sort: [{ field_name: 'price', direction: 'asc' }],
        },
        sub_aggregation: {
          fields: ['brand'],
          size: 2,
          metrics: {
            doc_count: { op: 'count', field_name: '*' },
            avg_rating: { op: 'avg', field_name: 'rating' },
          },
          order: [{ key: 'avg_rating', direction: 'desc' }],
          top_hits: {
            size: 2,
            sort: [{ field_name: 'price', direction: 'asc' }],
          },
        },
      },
    });

    expect(result.status.error_code).toBe(ErrorCode.SUCCESS);
    expect(result.results).toEqual([]);
    const aggBuckets = (result.agg_buckets as unknown) as AggregationBucket[][];
    expect(aggBuckets).toHaveLength(2);

    aggBuckets.forEach(buckets => {
      expect(buckets).toHaveLength(2);
      expect(buckets.map(bucket => keyValue(bucket, 'category'))).toEqual([
        'music',
        'books',
      ]);

      const expectedByCategory = {
        books: { min: 10, max: 40, sum: 100, avg: 25 },
        music: { min: 50, max: 80, sum: 260, avg: 65 },
      };

      buckets.forEach(bucket => {
        const category = keyValue(bucket, 'category') as 'books' | 'music';
        const expected = expectedByCategory[category];
        expect(Number(bucket.count)).toBe(4);
        expect(Number(bucket.metrics.doc_count)).toBe(4);
        expect(Number(bucket.metrics.min_price)).toBe(expected.min);
        expect(Number(bucket.metrics.max_price)).toBe(expected.max);
        expect(Number(bucket.metrics.total_price)).toBe(expected.sum);
        expect(Number(bucket.metrics.avg_price)).toBeCloseTo(expected.avg);
        expect(bucket.hits).toHaveLength(2);
        expect(bucket.hits.map(hit => Number(hit.price))).toEqual(
          category === 'books' ? [10, 20] : [50, 60]
        );
        bucket.hits.forEach(hit => {
          expect(hit.category).toBe(category);
          expect(hit.in_stock).toBe(true);
        });

        expect(bucket.sub_groups).toHaveLength(2);
        const brands = bucket.sub_groups.map(subBucket =>
          keyValue(subBucket, 'brand')
        );
        expect(brands.sort()).toEqual(['acme', 'zen']);
        bucket.sub_groups.forEach(subBucket => {
          const brand = keyValue(subBucket, 'brand');
          expect(Number(subBucket.count)).toBe(2);
          expect(Number(subBucket.metrics.doc_count)).toBe(2);
          expect(subBucket.hits).toHaveLength(2);
          const prices = subBucket.hits.map(hit => Number(hit.price));
          expect(prices).toEqual([...prices].sort((a, b) => a - b));
          subBucket.hits.forEach(hit => {
            expect(hit.category).toBe(category);
            expect(hit.brand).toBe(brand);
          });
          const expectedAverage =
            subBucket.hits.reduce((sum, hit) => sum + Number(hit.rating), 0) /
            subBucket.hits.length;
          expect(Number(subBucket.metrics.avg_rating)).toBeCloseTo(
            expectedAverage
          );
        });
      });
    });
  });

  it('returns a flat bucket array for a single query vector', async () => {
    const result = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      anns_field: 'vector',
      data: [1, 0],
      search_aggregation: {
        fields: ['category'],
        size: 2,
        metrics: {
          doc_count: { op: 'count', field_name: '*' },
        },
        order: [{ key: '_key', direction: 'asc' }],
      },
    });

    expect(result.status.error_code).toBe(ErrorCode.SUCCESS);
    expect(result.results).toEqual([]);
    expect(result.agg_buckets).toHaveLength(2);
    expect(
      result.agg_buckets!.map(bucket => keyValue(bucket, 'category'))
    ).toEqual(['books', 'music']);
  });
});
