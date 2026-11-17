import { IndexType, MetricType, SearchResultData } from '../../milvus';
import {
  collectionSchema,
  generateInsertData,
  DEFAULT_TIMESTAMPTZ_VALUE,
} from '../fixtures';
import { expectSuccess, step, withCollection } from '../support/scenario';

describe('spatial and temporal fields in wide mixed schemas', () => {
  it.each(['geometry', 'timestamptz'] as const)(
    '%s survives query, search and update',
    async field =>
      withCollection(async (client, collection_name) => {
        const schema = collectionSchema({
          collectionName: collection_name,
          autoID: false,
          dim: [8],
        });
        const rows = generateInsertData(schema.fields, 3).map((row, i) => ({
          ...row,
          vector: row.vector as number[],
          id: i + 1,
          geometry: `POINT (${i + 0.123456} ${-i - 0.654321})`,
          ...(i === 0
            ? {}
            : {
                timestamptz: [
                  '2024-01-01T08:00:00+08:00',
                  '2024-06-01T00:00:00Z',
                ][i - 1],
              }),
        }));
        delete rows[0].timestamptz;
        await step('create, index, insert and load', async () => {
          expectSuccess(await client.createCollection(schema));
          const description = await client.describeCollection({
            collection_name,
          });
          expectSuccess(description);
          const timestamp = description.schema.fields.find(
            item => item.name === 'timestamptz'
          )!;
          expect(new Date(timestamp.default_value as string)).toEqual(
            new Date(DEFAULT_TIMESTAMPTZ_VALUE)
          );
          expectSuccess(await client.insert({ collection_name, data: rows }));
          expectSuccess(
            await client.createIndex([
              {
                collection_name,
                field_name: 'vector',
                index_type: IndexType.AUTOINDEX,
                metric_type: MetricType.L2,
              },
              ...(field === 'geometry'
                ? [
                    {
                      collection_name,
                      field_name: 'geometry',
                      index_type: IndexType.RTREE,
                    },
                  ]
                : []),
            ])
          );
          expectSuccess(await client.loadCollectionSync({ collection_name }));
        });
        await step(
          'round-trip scalar values without relying on server row order',
          async () => {
            const count = await client.count({ collection_name });
            expectSuccess(count);
            expect(count.data).toBe(rows.length);
            const result = await client.query({
              collection_name,
              filter: 'id > 0',
              output_fields: ['id', field],
            });
            expectSuccess(result);
            expect(result.data).toHaveLength(rows.length);
            for (const row of rows) {
              const actual = result.data.find(
                item => String(item.id) === String(row.id)
              )!;
              if (field === 'geometry') {
                const coordinates = (value: string) =>
                  value.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
                coordinates(row.geometry).forEach((value, index) =>
                  expect(coordinates(actual.geometry)[index]).toBeCloseTo(
                    value,
                    5
                  )
                );
              } else
                expect(new Date(actual.timestamptz)).toEqual(
                  new Date(row.timestamptz || DEFAULT_TIMESTAMPTZ_VALUE)
                );
            }
            const search = await client.search({
              collection_name,
              nq: 2,
              data: [rows[0].vector, rows[1].vector],
              output_fields: ['id', field],
              limit: 3,
            });
            expectSuccess(search);
            expect(search.results).toHaveLength(2);
            for (const hits of search.results as unknown as SearchResultData[][])
              for (const hit of hits) expect(hit[field]).toBeDefined();
          }
        );
        await step(
          'update only the scalar and preserve vector data',
          async () => {
            const value =
              field === 'geometry' ? 'POINT (1 2)' : '2025-01-01T00:00:00Z';
            expectSuccess(
              await client.upsert({
                collection_name,
                partial_update: true,
                data: [{ id: 2, [field]: value }],
              })
            );
            const result = await client.query({
              collection_name,
              filter: 'id == 2',
              output_fields: ['vector', field],
            });
            expectSuccess(result);
            if (field === 'geometry')
              expect(result.data[0].geometry).toBe(value);
            else
              expect(new Date(result.data[0].timestamptz)).toEqual(
                new Date(value)
              );
            rows[1].vector.forEach((value: number, i: number) =>
              expect(result.data[0].vector[i]).toBeCloseTo(value, 6)
            );
          }
        );
      })
  );
});
