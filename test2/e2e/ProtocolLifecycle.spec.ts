import { DataType, HttpClient, IndexType, MetricType } from '../../milvus';
import { ENDPOINT } from '../fixtures';
import { expectHttpSuccess, expectSuccess } from '../support/assertions';
import { step, withCollection } from '../support/scenario';

// One dataset and one set of assertions exercise both wire protocols in both directions.
const rows = [
  {
    id: '9007199254740993',
    vector: [1, 0, 0, 0],
    label: 'apple',
    optional: null,
    dynamic: 'first',
  },
  {
    id: '9007199254740994',
    vector: [0, 1, 0, 0],
    label: 'orange',
    optional: 0,
    dynamic: 'second',
  },
];
describe('gRPC / HTTP interoperability', () => {
  it.each(['grpc', 'http'] as const)(
    'writes through %s and verifies both protocols',
    async writer =>
      withCollection(async (grpc, collection_name) => {
        const http = new HttpClient({ endpoint: ENDPOINT, acceptInt64: false });
        await step('create a schema shared by both protocols', async () => {
          expectSuccess(
            await grpc.createCollection({
              collection_name,
              consistency_level: 'Strong',
              enable_dynamic_field: true,
              fields: [
                {
                  name: 'id',
                  data_type: DataType.Int64,
                  is_primary_key: true,
                  autoID: false,
                },
                { name: 'vector', data_type: DataType.FloatVector, dim: 4 },
                { name: 'label', data_type: DataType.VarChar, max_length: 64 },
                { name: 'optional', data_type: DataType.Int32, nullable: true },
              ],
            })
          );
          expectSuccess(
            await grpc.createIndex({
              collection_name,
              field_name: 'vector',
              index_type: IndexType.FLAT,
              metric_type: MetricType.L2,
            })
          );
          expectSuccess(await grpc.loadCollectionSync({ collection_name }));
        });
        await step(`insert through ${writer}`, async () => {
          if (writer === 'grpc')
            expectSuccess(await grpc.insert({ collection_name, data: rows }));
          else
            expectHttpSuccess(
              await http.insert({ collectionName: collection_name, data: rows })
            );
        });
        const assertVisible = async (
          expectedLabels: string[],
          expectedIds = rows.map(row => row.id)
        ) => {
          const grpcResult = await grpc.query({
            collection_name,
            filter: 'id > 0',
            output_fields: ['id', 'label', 'optional', 'vector', 'dynamic'],
          });
          expectSuccess(grpcResult);
          const httpResult = await http.query({
            collectionName: collection_name,
            filter: 'id > 0',
            outputFields: ['id', 'label', 'optional', 'vector', 'dynamic'],
            consistencyLevel: 'Strong',
          });
          expectHttpSuccess(httpResult);
          for (const result of [grpcResult.data, httpResult.data]) {
            expect(result.map(row => String(row.id)).sort()).toEqual(
              [...expectedIds].sort()
            );
            for (let i = 0; i < expectedIds.length; i++) {
              const row = result.find(
                row => String(row.id) === expectedIds[i]
              )!;
              expect(row.label).toBe(expectedLabels[i]);
              const original = rows.find(
                expected => expected.id === expectedIds[i]
              )!;
              expect(row.optional).toBe(original.optional);
              expect(row.dynamic ?? row.$meta?.dynamic).toBe(original.dynamic);
              expect(row.vector).toEqual(
                rows.find(expected => expected.id === expectedIds[i])!.vector
              );
            }
          }
        };
        await step(
          'read and filter through both protocols without losing Int64 precision',
          async () => {
            await assertVisible(['apple', 'orange']);
            const grpcResult = await grpc.search({
              collection_name,
              data: rows[0].vector,
              filter: 'label == "apple"',
              output_fields: ['id'],
              limit: 2,
            });
            expectSuccess(grpcResult);
            const httpResult = await http.search({
              collectionName: collection_name,
              data: [rows[0].vector],
              filter: 'label == "apple"',
              outputFields: ['id'],
              limit: 2,
            });
            expectHttpSuccess(httpResult);
            expect(String(grpcResult.results[0].id)).toBe(rows[0].id);
            const hits = httpResult.data as unknown as {
              id: string | number;
            }[];
            expect(hits).toHaveLength(1);
            expect(String(hits[0].id)).toBe(rows[0].id);
          }
        );
        await step(
          'upsert through the other protocol and verify changed data',
          async () => {
            const replacement = { ...rows[0], label: 'updated' };
            if (writer === 'grpc')
              expectHttpSuccess(
                await http.upsert({
                  collectionName: collection_name,
                  data: [replacement],
                })
              );
            else
              expectSuccess(
                await grpc.upsert({ collection_name, data: [replacement] })
              );
            await assertVisible(['updated', 'orange']);
          }
        );
        await step(
          'delete through HTTP and verify final data through both protocols',
          async () => {
            expectHttpSuccess(
              await http.delete({
                collectionName: collection_name,
                filter: `id == ${rows[0].id}`,
              })
            );
            await assertVisible(['orange'], [rows[1].id]);
          }
        );
      })
  );
});
