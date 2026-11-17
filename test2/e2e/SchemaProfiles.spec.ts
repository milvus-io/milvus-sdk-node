import {
  DEFAULT_HIGH_LEVEL_SCHEMA,
  DEFAULT_HIGH_LEVEL_INDEX_PARAMS,
} from '../../milvus/const/highLevel';
import { DataType, IndexType, MetricType } from '../../milvus';
import { collectionSchema, generateInsertData } from '../fixtures';
import { expectSuccess, step, withCollection } from '../support/scenario';

const profiles = [
  {
    name: 'minimal/manual Int64',
    profile: 'minimal' as const,
    autoID: false,
    idType: DataType.Int64,
  },
  {
    name: 'wide/generated Int64',
    profile: 'wide' as const,
    autoID: true,
    idType: DataType.Int64,
  },
  {
    name: 'wide/generated VarChar',
    profile: 'wide' as const,
    autoID: true,
    idType: DataType.VarChar,
  },
];
describe('declared schema profiles', () => {
  it.each(profiles)('$name completes a data lifecycle', async profile =>
    withCollection(async (client, collection_name) => {
      const schema = collectionSchema({
        collectionName: collection_name,
        ...profile,
        dim: [4],
      });
      if (profile.idType === DataType.VarChar)
        schema.fields.find(field => field.is_primary_key)!.max_length = 64;
      const rows = generateInsertData(schema.fields, 3).map((row, index) => ({
        ...row,
        ...(profile.autoID ? {} : { id: index + 1 }),
        vector: [index + 1, 0, 0, 0],
      }));
      await step('create schema, write data and build index', async () => {
        expectSuccess(await client.createCollection(schema));
        expectSuccess(await client.insert({ collection_name, data: rows }));
        expectSuccess(
          await client.createIndex({
            collection_name,
            field_name: 'vector',
            index_type: IndexType.FLAT,
            metric_type: MetricType.L2,
          })
        );
        expectSuccess(await client.loadCollectionSync({ collection_name }));
      });
      const result = await client.query({
        collection_name,
        filter: profile.idType === DataType.VarChar ? 'id != ""' : 'id > 0',
        output_fields: ['id', 'vector'],
      });
      expectSuccess(result);
      expect(result.data).toHaveLength(3);
      expect(new Set(result.data.map(row => String(row.id))).size).toBe(3);
      for (const row of result.data) {
        const read = await client.get({
          collection_name,
          ids: [row.id],
          output_fields: ['id', 'vector'],
        });
        expectSuccess(read);
        expect(read.data).toHaveLength(1);
        expect(read.data[0].vector).toEqual(row.vector);
      }
    })
  );
  it('uses built-in default schema and index parameters together', async () =>
    withCollection(async (client, collection_name) => {
      const fields = DEFAULT_HIGH_LEVEL_SCHEMA(4);
      const index = DEFAULT_HIGH_LEVEL_INDEX_PARAMS('vector');
      expectSuccess(
        await client.createCollection({
          collection_name,
          fields,
          consistency_level: 'Strong',
        })
      );
      expectSuccess(
        await client.insert({
          collection_name,
          data: [{ id: 1, vector: [1, 0, 0, 0] }],
        })
      );
      expectSuccess(await client.createIndex({ collection_name, ...index }));
      expectSuccess(await client.loadCollectionSync({ collection_name }));
      const result = await client.search({
        collection_name,
        data: [1, 0, 0, 0],
        output_fields: ['id'],
        limit: 1,
      });
      expectSuccess(result);
      expect(String(result.results[0].id)).toBe('1');
    }));
});
