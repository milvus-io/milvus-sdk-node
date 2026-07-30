import {
  BulkWriter,
  DataType,
  ErrorCode,
  FunctionType,
  IndexType,
  MetricType,
  MilvusClient,
  RefreshExternalCollectionState,
  sleep,
} from '../../milvus';
import { GENERATE_NAME, IP } from '../tools';
import * as Minio from 'minio';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.setTimeout(180000);

const milvusClient = new MilvusClient({
  address: IP,
  username: process.env.MILVUS_USERNAME || 'root',
  password: process.env.MILVUS_PASSWORD || 'Milvus',
  logLevel: 'info',
});

const DEFAULT_EXTERNAL_SOURCE = 's3://test-bucket/data/';
const DEFAULT_EXTERNAL_SPEC = JSON.stringify({
  format: 'parquet',
  extfs: {
    access_key_id: 'dummy',
    access_key_value: 'dummy',
    region: 'us-east-1',
    cloud_provider: 'aws',
  },
});

const MINIO_ADDRESS = process.env.MINIO_ADDRESS || '127.0.0.1';
const MINIO_BUCKET = process.env.EXTERNAL_COLLECTION_MINIO_BUCKET || 'a-bucket';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const MILVUS_MINIO_ADDRESS =
  process.env.EXTERNAL_COLLECTION_MINIO_ADDRESS || 'minio:9000';

const minioClient = new Minio.Client({
  endPoint: MINIO_ADDRESS,
  port: 9000,
  useSSL: false,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});

const buildMinioExternalSpec = () =>
  JSON.stringify({
    format: 'parquet',
    extfs: {
      cloud_provider: 'minio',
      region: 'us-east-1',
      access_key_id: MINIO_ACCESS_KEY,
      access_key_value: MINIO_SECRET_KEY,
      use_ssl: 'false',
    },
  });

const waitForExternalRefresh = async (jobId: string) => {
  for (let attempt = 0; attempt < 120; attempt++) {
    const progress = await milvusClient.getRefreshExternalCollectionProgress({
      job_id: jobId,
    });
    expect(progress.status.error_code).toEqual(ErrorCode.SUCCESS);

    if (
      progress.job_info.state ===
      RefreshExternalCollectionState.RefreshCompleted
    ) {
      return;
    }
    if (
      progress.job_info.state === RefreshExternalCollectionState.RefreshFailed
    ) {
      throw new Error(progress.job_info.reason || 'External refresh failed');
    }

    await sleep(1000);
  }

  throw new Error('External collection refresh timed out');
};

describe('External Collection API', () => {
  const collectionName = GENERATE_NAME();

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: collectionName });
  });

  it('creates, describes, and refreshes an external collection with external field mappings', async () => {
    const create = await milvusClient.createCollection({
      collection_name: collectionName,
      external_source:
        process.env.EXTERNAL_COLLECTION_SOURCE || DEFAULT_EXTERNAL_SOURCE,
      external_spec:
        process.env.EXTERNAL_COLLECTION_SPEC || DEFAULT_EXTERNAL_SPEC,
      fields: [
        {
          name: 'product_id',
          data_type: DataType.Int64,
          external_field: 'id',
        },
        {
          name: 'name',
          data_type: DataType.VarChar,
          max_length: 256,
          external_field: 'name',
        },
        {
          name: 'vec',
          data_type: DataType.FloatVector,
          dim: 4,
          external_field: 'vector',
        },
      ],
    });

    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: collectionName,
    });

    expect(describe.schema.external_source).toBe(
      process.env.EXTERNAL_COLLECTION_SOURCE || DEFAULT_EXTERNAL_SOURCE
    );
    expect(describe.schema.external_spec).toBeTruthy();
    const externalSpec = JSON.parse(describe.schema.external_spec!);
    expect(externalSpec.format).toBe('parquet');
    const virtualPk = describe.schema.fields.find(
      field => field.name === '__virtual_pk__'
    );
    const productId = describe.schema.fields.find(
      field => field.name === 'product_id'
    );
    const name = describe.schema.fields.find(field => field.name === 'name');
    const vector = describe.schema.fields.find(field => field.name === 'vec');

    expect(virtualPk?.is_primary_key).toBe(true);
    expect(virtualPk?.autoID).toBe(true);
    expect(productId?.external_field).toBe('id');
    expect(name?.external_field).toBe('name');
    expect(vector?.external_field).toBe('vector');

    const refresh = await milvusClient.refreshExternalCollection({
      collection_name: collectionName,
    });
    expect(refresh.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(refresh.job_id).toBeTruthy();

    const progress = await milvusClient.getRefreshExternalCollectionProgress({
      job_id: refresh.job_id,
    });
    expect(progress.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(progress.job_info.collection_name).toBe(collectionName);

    const jobs = await milvusClient.listRefreshExternalCollectionJobs({
      collection_name: collectionName,
    });
    expect(jobs.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(Array.isArray(jobs.jobs)).toBe(true);
  });

  it('adds a nullable vector field to an external collection', async () => {
    const schemaEvolutionCollection = GENERATE_NAME();
    const nullableVectorField = 'nullable_vec';

    try {
      const create = await milvusClient.createCollection({
        collection_name: schemaEvolutionCollection,
        external_source:
          process.env.EXTERNAL_COLLECTION_SOURCE || DEFAULT_EXTERNAL_SOURCE,
        external_spec:
          process.env.EXTERNAL_COLLECTION_SPEC || DEFAULT_EXTERNAL_SPEC,
        fields: [
          {
            name: 'product_id',
            data_type: DataType.Int64,
            external_field: 'id',
          },
          {
            name: 'vec',
            data_type: DataType.FloatVector,
            dim: 4,
            external_field: 'vector',
          },
        ],
      });
      expect(create.error_code).toEqual(ErrorCode.SUCCESS);

      const add = await milvusClient.addCollectionField({
        collection_name: schemaEvolutionCollection,
        field: {
          name: nullableVectorField,
          data_type: DataType.FloatVector,
          dim: 4,
          nullable: true,
          external_field: 'nullable_vector',
        },
      });
      expect(add).toEqual(
        expect.objectContaining({ error_code: ErrorCode.SUCCESS })
      );

      const describeAfterAdd = await milvusClient.describeCollection({
        collection_name: schemaEvolutionCollection,
        cache: false,
      });
      const addedField = describeAfterAdd.schema.fields.find(
        field => field.name === nullableVectorField
      );
      expect(addedField).toBeDefined();
      expect(addedField?.data_type).toEqual('FloatVector');
      expect(Number(addedField?.dim)).toEqual(4);
      expect(addedField?.nullable).toEqual(true);
      expect(addedField?.external_field).toEqual('nullable_vector');
    } finally {
      await milvusClient.dropCollection({
        collection_name: schemaEvolutionCollection,
      });
    }
  });

  describe('Function and text search', () => {
    const functionCollection = GENERATE_NAME('external_function');
    const objectPrefix = `node-sdk-external/${functionCollection}`;
    const uploadedObjects: string[] = [];
    const sourceFields = [
      { name: 'id', data_type: DataType.Int64 },
      {
        name: 'text',
        data_type: DataType.VarChar,
        max_length: 512,
      },
      {
        name: 'sparse',
        data_type: DataType.SparseFloatVector,
        is_function_output: true,
      },
    ];
    const rows = [
      { id: 0, text: 'apple banana' },
      { id: 1, text: 'banana pear' },
      { id: 2, text: 'fresh apple pie' },
      { id: 3, text: 'orange fruit' },
      { id: 4, text: 'apple orchard' },
      { id: 5, text: 'distributed vector database' },
    ];

    beforeAll(async () => {
      if (!(await minioClient.bucketExists(MINIO_BUCKET))) {
        await minioClient.makeBucket(MINIO_BUCKET, 'us-east-1');
      }

      const localDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'external-function-')
      );
      try {
        const writer = new BulkWriter({
          schema: { fields: sourceFields },
          localPath: localDir,
          format: 'parquet',
        });
        for (const row of rows) {
          await writer.append(row);
        }

        const files = (await writer.close()).flat();
        for (const localFile of files) {
          const objectName = `${objectPrefix}/${path.basename(localFile)}`;
          await minioClient.fPutObject(
            MINIO_BUCKET,
            objectName,
            localFile
          );
          uploadedObjects.push(objectName);
        }
      } finally {
        fs.rmSync(localDir, { recursive: true, force: true });
      }

      const create = await milvusClient.createCollection({
        collection_name: functionCollection,
        external_source: `s3://${MILVUS_MINIO_ADDRESS}/${MINIO_BUCKET}/${objectPrefix}/`,
        external_spec: buildMinioExternalSpec(),
        fields: [
          {
            name: 'id',
            data_type: DataType.Int64,
            external_field: 'id',
          },
          {
            name: 'text',
            data_type: DataType.VarChar,
            max_length: 512,
            enable_analyzer: true,
            enable_match: true,
            analyzer_params: {
              tokenizer: 'standard',
              filter: ['lowercase'],
            },
            external_field: 'text',
          },
          {
            name: 'sparse',
            data_type: DataType.SparseFloatVector,
            is_function_output: true,
          },
        ],
        functions: [
          {
            name: 'bm25',
            type: FunctionType.BM25,
            input_field_names: ['text'],
            output_field_names: ['sparse'],
            params: {},
          },
        ],
      });
      expect(create.error_code).toEqual(ErrorCode.SUCCESS);

      const refresh = await milvusClient.refreshExternalCollection({
        collection_name: functionCollection,
      });
      expect(refresh.status.error_code).toEqual(ErrorCode.SUCCESS);
      await waitForExternalRefresh(refresh.job_id);

      const index = await milvusClient.createIndex({
        collection_name: functionCollection,
        field_name: 'sparse',
        index_type: IndexType.SPARSE_INVERTED_INDEX,
        metric_type: MetricType.BM25,
      });
      expect(index.error_code).toEqual(ErrorCode.SUCCESS);

      const load = await milvusClient.loadCollectionSync({
        collection_name: functionCollection,
      });
      expect(load.error_code).toEqual(ErrorCode.SUCCESS);
    });

    afterAll(async () => {
      await milvusClient.dropCollection({
        collection_name: functionCollection,
      });
      for (const objectName of uploadedObjects) {
        try {
          await minioClient.removeObject(MINIO_BUCKET, objectName);
        } catch {
          // best-effort cleanup
        }
      }
    });

    it('exposes the BM25 function in the external collection schema', async () => {
      const describe = await milvusClient.describeCollection({
        collection_name: functionCollection,
        cache: false,
      });
      const bm25 = describe.schema.functions.find(
        functionSchema => functionSchema.name === 'bm25'
      );
      const sparse = describe.schema.fields.find(
        field => field.name === 'sparse'
      );

      expect(bm25).toEqual(
        expect.objectContaining({
          type: 'BM25',
          input_field_names: ['text'],
          output_field_names: ['sparse'],
        })
      );
      expect(sparse?.is_function_output).toEqual(true);
    });

    it('runs full-text search on the external BM25 function output', async () => {
      const search = await milvusClient.search({
        collection_name: functionCollection,
        data: 'apple',
        anns_field: 'sparse',
        limit: 3,
        output_fields: ['id', 'text'],
      });

      expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
      expect(search.results).toHaveLength(3);
      expect(
        search.results.every(result => result.text.includes('apple'))
      ).toEqual(true);
    });

    it('filters external text fields with TEXT_MATCH', async () => {
      const query = await milvusClient.query({
        collection_name: functionCollection,
        filter: "TEXT_MATCH(text, 'apple')",
        output_fields: ['id', 'text'],
        limit: 10,
      });

      expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
      expect(
        query.data.map(row => Number(row.id)).sort((a, b) => a - b)
      ).toEqual([0, 2, 4]);
      expect(query.data.every(row => row.text.includes('apple'))).toEqual(true);
    });
  });
});
