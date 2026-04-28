import { DataType, ErrorCode, MilvusClient } from '../../milvus';
import { GENERATE_NAME, IP } from '../tools';

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
});
