/**
 * Test nullable vector support for all 6 vector types in milvus-sdk-node
 *
 * Vector generators follow the style of examples in data.ts
 */

import {
  MilvusClient,
  ErrorCode,
  DataType,
  IndexType,
  MetricType,
  ERROR_REASONS,
} from '../../milvus';
import { IP, GENERATE_NAME } from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });

const dbParam = {
  db_name: 'nullable_vector_DB',
};

// Test dimension
const DIM = 8;

// Vector generators
const genFloatVector = (dim: number): number[] => {
  return Array.from({ length: dim }, () => Math.random());
};

const genBinaryVector = (dim: number): number[] => {
  // dim for binary is in bits, need dim/8 bytes
  const numBytes = Math.ceil(dim / 8);
  return Array.from({ length: numBytes }, () =>
    Math.floor(Math.random() * 256)
  );
};

const genFloat16Vector = (dim: number): number[] => {
  // In Node SDK, float16 vectors can be passed as float32 arrays
  return Array.from({ length: dim }, () => Math.random());
};

const genBFloat16Vector = (dim: number): number[] => {
  // In Node SDK, bfloat16 vectors can be passed as float32 arrays
  return Array.from({ length: dim }, () => Math.random());
};

const genSparseVector = (): { [key: number]: number } => {
  const dim = Math.floor(Math.random() * 18) + 2;
  const result: { [key: number]: number } = {};
  for (let i = 0; i < dim; i++) {
    result[Math.floor(Math.random() * 100)] = Math.random();
  }
  return result;
};

const genInt8Vector = (dim: number): number[] => {
  // Use 0-127 range to avoid signed/unsigned interpretation issues
  return Array.from({ length: dim }, () => Math.floor(Math.random() * 128));
};

// Vector comparison functions
const vectorsEqual = (
  v1: any,
  v2: any,
  vtypeName: string,
  rtol = 1e-3,
  atol = 1e-3
): boolean => {
  if (v1 === null && v2 === null) return true;
  if (v1 === null || v2 === null) return false;

  if (vtypeName === 'sparse_float_vector') {
    // Sparse vectors are objects
    const keys1 = Object.keys(v1).map(Number);
    const keys2 = Object.keys(v2).map(Number);
    if (keys1.length !== keys2.length) return false;
    for (const k of keys1) {
      if (!(k in v2)) return false;
      if (Math.abs(v1[k] - v2[k]) > atol) return false;
    }
    return true;
  } else if (vtypeName === 'binary_vector' || vtypeName === 'int8_vector') {
    // Binary and Int8 vectors: exact integer comparison
    const arr1 = Array.isArray(v1) ? v1 : [v1];
    const arr2 = Array.isArray(v2) ? v2 : [v2];
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false;
    }
    return true;
  } else if (vtypeName === 'bfloat16_vector') {
    // BFloat16 has lower precision, use larger tolerance
    const arr1 = Array.isArray(v1) ? v1 : [v1];
    const arr2 = Array.isArray(v2) ? v2 : [v2];
    if (arr1.length !== arr2.length) return false;
    const bf16Atol = 0.01; // BFloat16 has ~7 bits of mantissa precision
    for (let i = 0; i < arr1.length; i++) {
      const diff = Math.abs(arr1[i] - arr2[i]);
      if (diff > bf16Atol + 0.01 * Math.abs(arr2[i])) return false;
    }
    return true;
  } else {
    // Float vectors: compare with tolerance
    const arr1 = Array.isArray(v1) ? v1 : [v1];
    const arr2 = Array.isArray(v2) ? v2 : [v2];
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
      const diff = Math.abs(arr1[i] - arr2[i]);
      if (diff > atol + rtol * Math.abs(arr2[i])) return false;
    }
    return true;
  }
};

// Define all 6 vector types with their test data generators
const VECTOR_TYPES = [
  {
    name: 'float_vector',
    dtype: DataType.FloatVector,
    dim: DIM,
    genVector: () => genFloatVector(DIM),
    indexType: IndexType.FLAT,
    metricType: MetricType.L2,
  },
  {
    name: 'binary_vector',
    dtype: DataType.BinaryVector,
    dim: DIM * 8, // binary dim must be multiple of 8
    genVector: () => genBinaryVector(DIM * 8),
    indexType: IndexType.BIN_FLAT,
    metricType: MetricType.HAMMING,
  },
  {
    name: 'float16_vector',
    dtype: DataType.Float16Vector,
    dim: DIM,
    genVector: () => genFloat16Vector(DIM),
    indexType: IndexType.FLAT,
    metricType: MetricType.L2,
  },
  {
    name: 'bfloat16_vector',
    dtype: DataType.BFloat16Vector,
    dim: DIM,
    genVector: () => genBFloat16Vector(DIM),
    indexType: IndexType.FLAT,
    metricType: MetricType.L2,
  },
  {
    name: 'sparse_float_vector',
    dtype: DataType.SparseFloatVector,
    dim: null, // sparse vectors don't need dim
    genVector: genSparseVector,
    indexType: IndexType.SPARSE_INVERTED_INDEX,
    metricType: MetricType.IP,
    indexParams: { drop_ratio_build: 0.2 },
  },
  {
    name: 'int8_vector',
    dtype: DataType.Int8Vector,
    dim: DIM,
    genVector: () => genInt8Vector(DIM),
    indexType: IndexType.HNSW,
    metricType: MetricType.L2,
    indexParams: { M: 8, efConstruction: 200 },
  },
];

describe('Nullable Vector Tests', () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropDatabase(dbParam);
  });

  // Test each vector type
  VECTOR_TYPES.forEach(vectorConfig => {
    describe(`Nullable ${vectorConfig.name}`, () => {
      const COLLECTION_NAME = GENERATE_NAME(`nullable_${vectorConfig.name}`);
      const BATCH_SIZE = 100;
      const NUM_BATCHES = 2;
      const NULL_PERCENT = 50;

      const expectedEmbeddings: Map<number, any> = new Map();
      let currentId = 0;
      let totalNull = 0;
      let totalValid = 0;

      afterAll(async () => {
        await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
      });

      it(`should create collection with nullable ${vectorConfig.name}`, async () => {
        const fields: any[] = [
          {
            name: 'id',
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: false,
          },
          {
            name: 'name',
            data_type: DataType.VarChar,
            max_length: 100,
          },
        ];

        // Add vector field with or without dim
        if (vectorConfig.dim !== null) {
          fields.push({
            name: 'embedding',
            data_type: vectorConfig.dtype,
            dim: vectorConfig.dim,
            nullable: true,
          });
        } else {
          fields.push({
            name: 'embedding',
            data_type: vectorConfig.dtype,
            nullable: true,
          });
        }

        const create = await milvusClient.createCollection({
          collection_name: COLLECTION_NAME,
          fields,
        });
        expect(create.error_code).toEqual(ErrorCode.SUCCESS);

        const describe = await milvusClient.describeCollection({
          collection_name: COLLECTION_NAME,
        });
        const embeddingField = describe.schema.fields.find(
          (f: any) => f.name === 'embedding'
        );
        expect(embeddingField).toBeDefined();
        expect(embeddingField!.nullable).toBe(true);
      });

      it(`should create index for nullable ${vectorConfig.name}`, async () => {
        const indexRes = await milvusClient.createIndex({
          collection_name: COLLECTION_NAME,
          field_name: 'embedding',
          index_type: vectorConfig.indexType,
          metric_type: vectorConfig.metricType,
          params: vectorConfig.indexParams || {},
        });
        expect(indexRes.error_code).toEqual(ErrorCode.SUCCESS);
      });

      it(`should insert data with ${NULL_PERCENT}% null vectors`, async () => {
        for (let batchIdx = 0; batchIdx < NUM_BATCHES; batchIdx++) {
          const data: any[] = [];
          for (let i = 0; i < BATCH_SIZE; i++) {
            const rowId = currentId + i;
            const isNull = Math.random() * 100 < NULL_PERCENT;
            const embedding = isNull ? null : vectorConfig.genVector();
            expectedEmbeddings.set(rowId, embedding);

            if (isNull) {
              totalNull++;
            } else {
              totalValid++;
            }

            data.push({
              id: rowId,
              name: `row_${rowId}`,
              embedding,
            });
          }
          currentId += BATCH_SIZE;

          const insert = await milvusClient.insert({
            collection_name: COLLECTION_NAME,
            data,
          });
          expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
          expect(insert.succ_index.length).toEqual(BATCH_SIZE);
        }
      });

      it(`should load collection`, async () => {
        const load = await milvusClient.loadCollection({
          collection_name: COLLECTION_NAME,
        });
        expect(load.error_code).toEqual(ErrorCode.SUCCESS);
      });

      it(`should query and verify nullable ${vectorConfig.name} values`, async () => {
        const query = await milvusClient.query({
          collection_name: COLLECTION_NAME,
          filter: 'id >= 0',
          output_fields: ['id', 'embedding'],
          limit: currentId + 100,
        });

        expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
        expect(query.data.length).toEqual(currentId);

        let queryNull = 0;
        let queryValid = 0;

        for (const row of query.data) {
          // Handle both string and number id types
          const rowId =
            typeof row.id === 'string' ? parseInt(row.id) : (row.id as number);
          const embedding = row.embedding;
          const expected = expectedEmbeddings.get(rowId);

          if (embedding === null) {
            queryNull++;
          } else {
            queryValid++;
          }

          expect(
            vectorsEqual(embedding, expected, vectorConfig.name)
          ).toBeTruthy();
        }

        expect(queryNull).toEqual(totalNull);
        expect(queryValid).toEqual(totalValid);
      });

      it(`should search and only return non-null ${vectorConfig.name} vectors`, async () => {
        if (totalValid === 0) {
          // Skip search test if no valid vectors
          return;
        }

        const searchVector = vectorConfig.genVector();
        const search = await milvusClient.search({
          collection_name: COLLECTION_NAME,
          data: [searchVector],
          anns_field: 'embedding',
          limit: Math.min(100, totalValid),
          output_fields: ['id', 'embedding'],
        });

        expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);

        // When nq=1, results is a flat array (SearchResultData[])
        for (const hit of search.results as any[]) {
          // Handle both string and number id types
          const hitId =
            typeof hit.id === 'string' ? parseInt(hit.id) : (hit.id as number);
          const embedding = hit.embedding;
          const expected = expectedEmbeddings.get(hitId);

          // Search should never return null vectors
          expect(embedding).not.toBeNull();

          expect(
            vectorsEqual(embedding, expected, vectorConfig.name)
          ).toBeTruthy();
        }
      });
    });
  });
});

describe('Add Nullable Vector Column Tests', () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropDatabase(dbParam);
  });

  // Test add column for each vector type
  VECTOR_TYPES.forEach(vectorConfig => {
    describe(`Add nullable ${vectorConfig.name} column`, () => {
      const COLLECTION_NAME = GENERATE_NAME(`add_col_${vectorConfig.name}`);
      const INITIAL_ROWS = 50;
      const NEW_ROWS = 50;
      const NULL_PERCENT = 50;

      const expectedEmbeddings: Map<number, any> = new Map();
      let totalNull = INITIAL_ROWS; // Initial rows all have null embedding
      let totalValid = 0;

      afterAll(async () => {
        await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
      });

      it(`should create collection with base vector field`, async () => {
        const create = await milvusClient.createCollection({
          collection_name: COLLECTION_NAME,
          fields: [
            {
              name: 'id',
              data_type: DataType.Int64,
              is_primary_key: true,
              autoID: false,
            },
            {
              name: 'name',
              data_type: DataType.VarChar,
              max_length: 100,
            },
            {
              name: 'base_vec',
              data_type: DataType.FloatVector,
              dim: 4,
            },
          ],
        });
        expect(create.error_code).toEqual(ErrorCode.SUCCESS);
      });

      it(`should insert initial data without embedding column`, async () => {
        const data: any[] = [];
        for (let i = 0; i < INITIAL_ROWS; i++) {
          expectedEmbeddings.set(i, null);
          data.push({
            id: i,
            name: `initial_${i}`,
            base_vec: [Math.random(), Math.random(), Math.random(), Math.random()],
          });
        }

        const insert = await milvusClient.insert({
          collection_name: COLLECTION_NAME,
          data,
        });
        expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);

        // Flush to seal the growing segment before adding new field
        await milvusClient.flush({ collection_names: [COLLECTION_NAME] });
        // Wait for flush to complete and segments to be sealed
        await new Promise(resolve => setTimeout(resolve, 2000));
      });

      it(`should throw error when adding vector field without nullable`, async () => {
        const field: any = {
          name: 'embedding',
          data_type: vectorConfig.dtype,
          // nullable: true, // Missing!
        };
        if (vectorConfig.dim !== null) {
          field.dim = vectorConfig.dim;
        }

        await expect(
          milvusClient.addCollectionField({
            collection_name: COLLECTION_NAME,
            field,
          })
        ).rejects.toThrow(ERROR_REASONS.ADD_VECTOR_FIELD_MUST_BE_NULLABLE);
      });

      it(`should add nullable ${vectorConfig.name} column`, async () => {
        const field: any = {
          name: 'embedding',
          data_type: vectorConfig.dtype,
          nullable: true,
        };
        if (vectorConfig.dim !== null) {
          field.dim = vectorConfig.dim;
        }

        const addField = await milvusClient.addCollectionField({
          collection_name: COLLECTION_NAME,
          field,
        });
        expect(addField.error_code).toEqual(ErrorCode.SUCCESS);

        // Verify field was added (use cache: false to refresh schema)
        const describe = await milvusClient.describeCollection({
          collection_name: COLLECTION_NAME,
          cache: false,
        });
        const embeddingField = describe.schema.fields.find(
          (f: any) => f.name === 'embedding'
        );
        expect(embeddingField).toBeDefined();
        expect(embeddingField!.nullable).toBe(true);
      });

      it(`should create indexes`, async () => {
        const baseIndex = await milvusClient.createIndex({
          collection_name: COLLECTION_NAME,
          field_name: 'base_vec',
          index_type: IndexType.FLAT,
          metric_type: MetricType.L2,
        });
        expect(baseIndex.error_code).toEqual(ErrorCode.SUCCESS);

        const embeddingIndex = await milvusClient.createIndex({
          collection_name: COLLECTION_NAME,
          field_name: 'embedding',
          index_type: vectorConfig.indexType,
          metric_type: vectorConfig.metricType,
          params: vectorConfig.indexParams || {},
        });
        expect(embeddingIndex.error_code).toEqual(ErrorCode.SUCCESS);
      });

      it(`should insert new data with embedding`, async () => {
        const data: any[] = [];
        for (let i = 0; i < NEW_ROWS; i++) {
          const rowId = INITIAL_ROWS + i;
          const isNull = Math.random() * 100 < NULL_PERCENT;
          const embedding = isNull ? null : vectorConfig.genVector();
          expectedEmbeddings.set(rowId, embedding);

          if (isNull) {
            totalNull++;
          } else {
            totalValid++;
          }

          data.push({
            id: rowId,
            name: `new_${rowId}`,
            base_vec: [Math.random(), Math.random(), Math.random(), Math.random()],
            embedding,
          });
        }

        const insert = await milvusClient.insert({
          collection_name: COLLECTION_NAME,
          data,
        });
        expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);

        // Flush to seal the growing segment before load
        await milvusClient.flush({ collection_names: [COLLECTION_NAME] });
        // Wait for flush to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
      });

      it(`should load collection`, async () => {
        const load = await milvusClient.loadCollection({
          collection_name: COLLECTION_NAME,
        });
        expect(load.error_code).toEqual(ErrorCode.SUCCESS);
      });

      it(`should query and verify nullable values`, async () => {
        const totalRows = INITIAL_ROWS + NEW_ROWS;
        const query = await milvusClient.query({
          collection_name: COLLECTION_NAME,
          filter: 'id >= 0',
          output_fields: ['id', 'embedding'],
          limit: totalRows + 100,
        });

        expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
        expect(query.data.length).toEqual(totalRows);

        let queryNull = 0;
        let queryValid = 0;

        for (const row of query.data) {
          // Handle both string and number id types
          const rowId =
            typeof row.id === 'string' ? parseInt(row.id) : (row.id as number);
          const embedding = row.embedding;
          const expected = expectedEmbeddings.get(rowId);

          if (embedding === null) {
            queryNull++;
          } else {
            queryValid++;
          }

          expect(
            vectorsEqual(embedding, expected, vectorConfig.name)
          ).toBeTruthy();
        }

        expect(queryNull).toEqual(totalNull);
        expect(queryValid).toEqual(totalValid);
      });

      it(`should search and only return non-null vectors from new rows`, async () => {
        if (totalValid === 0) {
          return;
        }

        const searchVector = vectorConfig.genVector();
        const search = await milvusClient.search({
          collection_name: COLLECTION_NAME,
          data: [searchVector],
          anns_field: 'embedding',
          limit: Math.min(100, totalValid),
          output_fields: ['id', 'embedding'],
        });

        expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);

        // When nq=1, results is a flat array (SearchResultData[])
        for (const hit of search.results as any[]) {
          // Handle both string and number id types
          const hitId =
            typeof hit.id === 'string' ? parseInt(hit.id) : (hit.id as number);
          const embedding = hit.embedding;
          const expected = expectedEmbeddings.get(hitId);

          // Search should never return null vectors
          expect(embedding).not.toBeNull();

          // All search results should be from new rows (id >= INITIAL_ROWS)
          expect(hitId).toBeGreaterThanOrEqual(INITIAL_ROWS);

          expect(
            vectorsEqual(embedding, expected, vectorConfig.name)
          ).toBeTruthy();
        }
      });
    });
  });
});
