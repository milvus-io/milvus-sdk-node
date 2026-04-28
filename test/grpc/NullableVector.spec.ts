import {
  MilvusClient,
  ErrorCode,
  DataType,
  IndexType,
  MetricType,
} from '../../milvus';
import { IP, GENERATE_NAME } from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
const dbParam = {
  db_name: 'nullable_vector_test',
};

type NullableVectorCase = {
  label: string;
  dataType: DataType;
  dim?: number;
  metricType: MetricType;
  indexType: IndexType;
  indexParams?: Record<string, any>;
  searchParams?: Record<string, any>;
  vectors: any[];
  searchVector: any;
  expectVector: (actual: any, expected: any) => void;
};

const expectDenseVector = (actual: number[], expected: number[]) => {
  expect(actual.length).toBe(expected.length);
  expected.forEach((value, index) => {
    expect(actual[index]).toBeCloseTo(value, 3);
  });
};

const expectExactVector = (actual: any, expected: any) => {
  expect(actual).toEqual(expected);
};

const cleanupCollection = async (collectionName: string) => {
  await milvusClient
    .releaseCollection({ collection_name: collectionName })
    .catch(() => undefined);
  await milvusClient
    .dropCollection({ collection_name: collectionName })
    .catch(() => undefined);
};

const nullableVectorCases: NullableVectorCase[] = [
  {
    label: 'float vector',
    dataType: DataType.FloatVector,
    dim: 2,
    metricType: MetricType.L2,
    indexType: IndexType.AUTOINDEX,
    vectors: [[1, 2], null, [3, 4]],
    searchVector: [1, 2],
    expectVector: expectDenseVector,
  },
  {
    label: 'binary vector',
    dataType: DataType.BinaryVector,
    dim: 8,
    metricType: MetricType.HAMMING,
    indexType: IndexType.BIN_IVF_FLAT,
    indexParams: { nlist: 8 },
    vectors: [[1], null, [2]],
    searchVector: [1],
    expectVector: expectExactVector,
  },
  {
    label: 'float16 vector',
    dataType: DataType.Float16Vector,
    dim: 2,
    metricType: MetricType.L2,
    indexType: IndexType.AUTOINDEX,
    vectors: [[1, 2], null, [3, 4]],
    searchVector: [1, 2],
    expectVector: expectDenseVector,
  },
  {
    label: 'bfloat16 vector',
    dataType: DataType.BFloat16Vector,
    dim: 2,
    metricType: MetricType.L2,
    indexType: IndexType.AUTOINDEX,
    vectors: [[1, 2], null, [3, 4]],
    searchVector: [1, 2],
    expectVector: expectDenseVector,
  },
  {
    label: 'sparse vector',
    dataType: DataType.SparseFloatVector,
    metricType: MetricType.IP,
    indexType: IndexType.SPARSE_WAND,
    indexParams: { inverted_index_algo: 'DAAT_MAXSCORE' },
    searchParams: { drop_ratio_search: 0.2 },
    vectors: [{ '0': 1 }, null, { '1': 2 }],
    searchVector: { '0': 1 },
    expectVector: expectExactVector,
  },
  {
    label: 'int8 vector',
    dataType: DataType.Int8Vector,
    dim: 2,
    metricType: MetricType.L2,
    indexType: IndexType.HNSW,
    indexParams: { M: 16, efConstruction: 64 },
    vectors: [[1, 2], null, [3, 4]],
    searchVector: [1, 2],
    expectVector: expectExactVector,
  },
];

describe('Nullable vector API testing', () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.use({ db_name: 'default' });
    await milvusClient.dropDatabase(dbParam);
  });

  it.each(nullableVectorCases)(
    'insert, upsert, query, and search nullable $label should be successful',
    async testCase => {
      const collectionName = GENERATE_NAME();

      try {
        const vectorField: any = {
          name: 'vector',
          data_type: testCase.dataType,
          nullable: true,
        };
        if (testCase.dim) {
          vectorField.dim = testCase.dim;
        }

        const create = await milvusClient.createCollection({
          collection_name: collectionName,
          fields: [
            vectorField,
            {
              name: 'id',
              data_type: DataType.Int64,
              is_primary_key: true,
              autoID: false,
            },
          ],
        });
        expect(create.error_code).toEqual(ErrorCode.SUCCESS);

        const rows = testCase.vectors.map((vector, index) => ({
          id: index + 1,
          vector,
        }));
        const insert = await milvusClient.insert({
          collection_name: collectionName,
          data: rows,
        });
        expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
        expect(insert.succ_index.length).toEqual(rows.length);

        const upsert = await milvusClient.upsert({
          collection_name: collectionName,
          data: [
            { id: 2, vector: testCase.vectors[2] },
            { id: 3, vector: null },
          ],
        });
        expect(upsert.status.error_code).toEqual(ErrorCode.SUCCESS);

        const index = await milvusClient.createIndex({
          collection_name: collectionName,
          field_name: 'vector',
          metric_type: testCase.metricType,
          index_type: testCase.indexType,
          params: testCase.indexParams,
        });
        expect(index.error_code).toEqual(ErrorCode.SUCCESS);

        const load = await milvusClient.loadCollectionSync({
          collection_name: collectionName,
        });
        expect(load.error_code).toEqual(ErrorCode.SUCCESS);

        const query = await milvusClient.query({
          collection_name: collectionName,
          filter: 'id >= 1',
          output_fields: ['id', 'vector'],
        });
        expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
        expect(query.data).toHaveLength(rows.length);
        const sortedRows = [...query.data].sort(
          (a, b) => Number(a.id) - Number(b.id)
        );
        testCase.expectVector(sortedRows[0].vector, testCase.vectors[0]);
        testCase.expectVector(sortedRows[1].vector, testCase.vectors[2]);
        expect(sortedRows[2].vector).toBeNull();

        const search = await milvusClient.search({
          collection_name: collectionName,
          data: testCase.searchVector,
          output_fields: ['id', 'vector'],
          limit: 3,
          params: testCase.searchParams,
        });
        expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
        const searchResults = search.results as any[];
        expect(searchResults.length).toBeGreaterThan(0);
        expect(searchResults.every(result => result.vector !== null)).toBe(
          true
        );
      } finally {
        await cleanupCollection(collectionName);
      }
    }
  );

  it('new nullable vector field should return null for old rows', async () => {
    const collectionName = GENERATE_NAME();

    try {
      const create = await milvusClient.createCollection({
        collection_name: collectionName,
        fields: [
          {
            name: 'vector',
            data_type: DataType.FloatVector,
            dim: 2,
          },
          {
            name: 'id',
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: false,
          },
        ],
      });
      expect(create.error_code).toEqual(ErrorCode.SUCCESS);

      const insert = await milvusClient.insert({
        collection_name: collectionName,
        data: [
          { id: 1, vector: [1, 2] },
          { id: 2, vector: [3, 4] },
        ],
      });
      expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);

      const addNullableVector = await milvusClient.addCollectionField({
        collection_name: collectionName,
        field: {
          name: 'nullable_vector',
          data_type: DataType.FloatVector,
          dim: 2,
          nullable: true,
        },
      });
      expect(addNullableVector.error_code).toEqual(ErrorCode.SUCCESS);

      const index = await milvusClient.createIndex([
        {
          collection_name: collectionName,
          field_name: 'vector',
          metric_type: MetricType.L2,
          index_type: IndexType.AUTOINDEX,
        },
        {
          collection_name: collectionName,
          field_name: 'nullable_vector',
          metric_type: MetricType.L2,
          index_type: IndexType.AUTOINDEX,
        },
      ]);
      expect(index.error_code).toEqual(ErrorCode.SUCCESS);

      const load = await milvusClient.loadCollectionSync({
        collection_name: collectionName,
      });
      expect(load.error_code).toEqual(ErrorCode.SUCCESS);

      const queryOldRows = await milvusClient.query({
        collection_name: collectionName,
        filter: 'id >= 1',
        output_fields: ['id', 'nullable_vector'],
      });
      expect(queryOldRows.status.error_code).toEqual(ErrorCode.SUCCESS);
      expect(queryOldRows.data).toHaveLength(2);
      expect(queryOldRows.data.every(row => row.nullable_vector === null)).toBe(
        true
      );

      const addNonNullableVector = await milvusClient.addCollectionField({
        collection_name: collectionName,
        field: {
          name: 'non_nullable_vector',
          data_type: DataType.FloatVector,
          dim: 2,
        },
      });
      expect(addNonNullableVector.error_code).not.toEqual(ErrorCode.SUCCESS);
    } finally {
      await cleanupCollection(collectionName);
    }
  });
});
