import { DataType, IndexType, MetricType } from '../../milvus';
import { DenseVectorType, mixedRows, mixedSchema } from '../fixtures/schemas';
import { expectSuccess, step, withCollection } from '../support/scenario';

describe('Mixed schema lifecycle E2E', () => {
  it.each<DenseVectorType>([
    DataType.FloatVector,
    DataType.Float16Vector,
    DataType.BFloat16Vector,
  ])(
    'round-trips mixed fields, filters, updates and deletes with vector type %s',
    async vectorType =>
      withCollection(async (client, collection_name) => {
        const rows = mixedRows();
        await step('create mixed schema and insert boundary rows', async () => {
          expectSuccess(
            await client.createCollection({
              collection_name,
              ...mixedSchema(vectorType),
            })
          );
          const insert = await client.insert({ collection_name, data: rows });
          expectSuccess(insert);
          expect(Number(insert.insert_cnt)).toBe(rows.length);
        });
        await step('index dense and sparse vectors, then load', async () => {
          expectSuccess(
            await client.createIndex([
              {
                collection_name,
                field_name: 'vector',
                index_type: IndexType.FLAT,
                metric_type: MetricType.L2,
              },
              {
                collection_name,
                field_name: 'sparse',
                index_type: IndexType.SPARSE_INVERTED_INDEX,
                metric_type: MetricType.IP,
              },
            ])
          );
          expectSuccess(await client.loadCollectionSync({ collection_name }));
        });
        const read = async () => {
          const result = await client.query({
            collection_name,
            filter: 'id > 0',
            output_fields: ['*', 'dynamic_label'],
          });
          expectSuccess(result);
          return new Map(result.data.map(row => [String(row.id), row]));
        };
        await step('round-trip every field by primary key', async () => {
          const actual = await read();
          expect(actual.size).toBe(rows.length);
          for (const row of rows) {
            const found = actual.get(String(row.id))!;
            const { geometry, timestamp, dynamic_label, ...expected } = row;
            expect(found).toMatchObject({
              ...expected,
              $meta: { dynamic_label },
              id: String(row.id),
              optional: row.optional ?? null,
              default_zero: row.default_zero ?? 0,
              default_false: row.default_false ?? false,
              default_empty: row.default_empty ?? '',
            });
            expect(found.geometry.replace(/\s+/g, '')).toBe(
              geometry.replace(/\s+/g, '')
            );
            expect(new Date(found.timestamp).getTime()).toBe(
              new Date(timestamp).getTime()
            );
          }
        });
        await step(
          'dense and sparse search with JSON and dynamic filters',
          async () => {
            const dense = await client.search({
              collection_name,
              anns_field: 'vector',
              data: rows[1].vector,
              filter:
                'json["group"] == "fruit" and dynamic_label == "dynamic_1"',
              output_fields: ['id', 'label'],
              limit: 2,
            });
            expectSuccess(dense);
            expect(dense.results.map(r => String(r.id))).toEqual(['2']);
            const sparse = await client.search({
              collection_name,
              anns_field: 'sparse',
              data: [{ 0: 1 }],
              output_fields: ['id'],
              limit: 3,
            });
            expectSuccess(sparse);
            expect(sparse.results.map(r => String(r.id))).toEqual([
              '3',
              '2',
              '1',
            ]);
          }
        );
        await step(
          'partial update preserves every unrelated field',
          async () => {
            const before = await read();
            expectSuccess(
              await client.upsert({
                collection_name,
                partial_update: true,
                data: [{ id: 2, label: 'updated' }],
              })
            );
            const after = await read();
            expect(after.get('2')).toEqual({
              ...before.get('2'),
              label: 'updated',
            });
            expect(after.get('1')).toEqual(before.get('1'));
            expect(after.get('3')).toEqual(before.get('3'));
          }
        );
        await step(
          'add default field and verify existing and new rows',
          async () => {
            expectSuccess(
              await client.addCollectionField({
                collection_name,
                field: {
                  name: 'added',
                  data_type: DataType.Int32,
                  nullable: true,
                  default_value: 42,
                },
              })
            );
            expectSuccess(
              await client.insert({
                collection_name,
                data: [{ ...rows[2], id: 4 }],
              })
            );
            const actual = await read();
            expect(actual.size).toBe(4);
            for (const row of actual.values()) expect(row.added).toBe(42);
          }
        );
        await step('delete and verify final visible IDs', async () => {
          expectSuccess(
            await client.delete({ collection_name, filter: 'id in [1, 2]' })
          );
          expect([...(await read()).keys()].sort()).toEqual(['3', '4']);
        });
      })
  );
});
