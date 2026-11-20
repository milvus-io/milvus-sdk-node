import { createClient } from '../support/client';
import { expectSuccess } from '../support/assertions';
import { waitFor } from '../support/wait';
import {
  ConsistencyLevelEnum,
  DataType,
  ErrorCode,
  IndexType,
  MetricType,
  MilvusClient,
} from '../../milvus';
import { GENERATE_NAME, IP } from '../fixtures';

jest.setTimeout(180000);

const milvusClient = createClient({ address: IP, logLevel: 'info' });
const COLLECTION_NAME = GENERATE_NAME('text_type');
const LONG_TEXT = 'milvus storage v3 text payload '.repeat(3000);

describe('Text data type', () => {
  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.closeConnection();
  });

  it('supports schema, long values, filtering, search, and upsert', async () => {
    const create = await milvusClient.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
        },
        {
          name: 'vector',
          data_type: DataType.FloatVector,
          dim: 4,
        },
        {
          name: 'content',
          data_type: DataType.Text,
          nullable: true,
          enable_analyzer: true,
          enable_match: true,
          analyzer_params: { tokenizer: 'standard' },
        },
      ],
    });
    expectSuccess(create);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });
    const contentField = describe.schema.fields.find(
      field => field.name === 'content'
    );
    expect(contentField?.dataType).toBe(DataType.Text);
    expect(contentField?.data_type).toBe('Text');
    expect(contentField?.max_length).toBeUndefined();

    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data: [
        {
          id: 1,
          vector: [1, 0, 0, 0],
          content: LONG_TEXT,
        },
        {
          id: 2,
          vector: [0, 1, 0, 0],
          content: 'Milvus 支持超长文本、向量检索和 emoji 🚀',
        },
        {
          id: 3,
          vector: [0, 0, 1, 0],
          content: null,
        },
      ],
    });
    expectSuccess(insert.status);

    const flush = await milvusClient.flushSync({
      collection_names: [COLLECTION_NAME],
    });
    expectSuccess(flush.status);

    const createIndex = await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'vector',
      index_type: IndexType.AUTOINDEX,
      metric_type: MetricType.COSINE,
    });
    expectSuccess(createIndex);

    const load = await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(load);

    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'id in [1, 2, 3]',
      output_fields: ['id', 'content'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });
    expectSuccess(query.status);

    const rows = new Map(query.data.map(row => [Number(row.id), row]));
    expect(rows.get(1)?.content).toBe(LONG_TEXT);
    expect(rows.get(2)?.content).toBe(
      'Milvus 支持超长文本、向量检索和 emoji 🚀'
    );
    expect(rows.get(3)?.content).toBeNull();

    const matched = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: "text_match(content, 'storage')",
      output_fields: ['id'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });
    expectSuccess(matched.status);
    expect(matched.data.map(row => Number(row.id))).toEqual([1]);

    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: [1, 0, 0, 0],
      filter: "text_match(content, 'storage')",
      output_fields: ['id', 'content'],
      limit: 3,
      consistency_level: ConsistencyLevelEnum.Strong,
    });
    expectSuccess(search.status);
    expect(search.results).toHaveLength(1);
    expect(Number(search.results[0].id)).toBe(1);
    expect(search.results[0].content).toBe(LONG_TEXT);

    const updatedText = `${LONG_TEXT} updated`;
    const upsert = await milvusClient.upsert({
      collection_name: COLLECTION_NAME,
      data: [
        {
          id: 2,
          vector: [0, 1, 0, 0],
          content: updatedText,
        },
      ],
    });
    expectSuccess(upsert.status);

    const flushUpsert = await waitFor(
      'collection flush quota after upsert',
      () => milvusClient.flushSync({ collection_names: [COLLECTION_NAME] }),
      response => response.status.error_code !== ErrorCode.RateLimit,
      { timeout: 15_000, interval: 1000 }
    );
    expectSuccess(flushUpsert.status);
    expect(flushUpsert.flushed).toBe(true);

    const release = await milvusClient.releaseCollection({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(release);

    const reload = await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
    expectSuccess(reload);

    const updated = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'id == 2',
      output_fields: ['id', 'content'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });
    expectSuccess(updated.status);
    expect(updated.data).toHaveLength(1);
    expect(updated.data[0].content).toBe(updatedText);
  });
});
