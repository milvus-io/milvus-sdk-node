import { DataType, IndexType, MetricType } from '../../milvus';
import { expectSuccess, withCollection } from '../support/scenario';

jest.setTimeout(180000);

// Milvus 3.0.6+: alter an existing struct, independently of adding a whole struct.
describe('adding StructArray sub-fields', () => {
  it.each([false, true])(
    'adds, reads, filters, and drops children of a loaded struct with nullable=%s',
    async nullable => {
      await withCollection(async (client, collection_name) => {
        expectSuccess(
          await client.createCollection({
            collection_name,
            consistency_level: 'Strong',
            fields: [
              { name: 'id', data_type: DataType.Int64, is_primary_key: true },
              { name: 'vector', data_type: DataType.FloatVector, dim: 2 },
              {
                name: 'items',
                data_type: DataType.Array,
                element_type: DataType.Struct,
                max_capacity: 20,
                nullable,
                fields: [
                  {
                    name: 'label',
                    data_type: DataType.VarChar,
                    max_length: 64,
                  },
                ],
              },
            ],
          })
        );
        expectSuccess(
          await client.createIndex({
            collection_name,
            field_name: 'vector',
            index_type: IndexType.FLAT,
            metric_type: MetricType.L2,
          })
        );
        expectSuccess(await client.loadCollectionSync({ collection_name }));
        expectSuccess(
          (
            await client.insert({
              collection_name,
              data: [{ id: 1, vector: [1, 0], items: [{ label: 'existing' }] }],
            })
          ).status
        );
        expectSuccess(
          await client.flushSync({ collection_names: [collection_name] })
        );
        // Populate the client cache before mutation to exercise invalidation.
        await client.describeCollection({ collection_name });

        for (const field of [
          { name: 'items[score]', data_type: DataType.Int64, nullable: true },
          {
            name: 'items[tags]',
            data_type: DataType.Array,
            element_type: DataType.VarChar,
            max_capacity: 8,
            max_length: 64,
            nullable: true,
          },
        ]) {
          expectSuccess(
            await client.addCollectionField({ collection_name, field })
          );
        }
        const describe = await client.describeCollection({ collection_name });
        expectSuccess(describe.status);
        const items = describe.schema.fields.find(
          field => field.name === 'items'
        )!;
        expect(items).toMatchObject({ nullable, max_capacity: '20' });
        expect(items.fields).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'score',
              data_type: 'Int64',
              nullable: true,
            }),
            expect.objectContaining({
              name: 'tags',
              data_type: 'Array',
              element_type: 'VarChar',
              max_capacity: '8',
              max_length: '64',
              nullable: true,
            }),
          ])
        );

        expectSuccess(
          (
            await client.insert({
              collection_name,
              data: [
                {
                  id: 2,
                  vector: [0, 1],
                  items: [
                    { label: 'present', score: 42, tags: ['red', 'blue'] },
                    { label: 'missing-between' },
                    { label: 'last', score: 7, tags: [] },
                  ],
                },
                { id: 3, vector: [1, 0], items: [{ label: 'omitted' }] },
                {
                  id: 4,
                  vector: [0, 1],
                  items: [{ label: 'null', score: null, tags: null }],
                },
                {
                  id: 5,
                  vector: [1, 0],
                  items: [{ label: 'empty', score: 0, tags: [] }],
                },
                { id: 6, vector: [0, 1], items: [] },
                ...(nullable ? [{ id: 7, vector: [1, 0], items: null }] : []),
              ],
            })
          ).status
        );
        const query = await client.query({
          collection_name,
          filter: 'id > 0',
          output_fields: ['id', 'items'],
        });
        expectSuccess(query.status);
        const byId = Object.fromEntries(
          query.data.map(row => [Number(row.id), row.items])
        );
        expect(byId[1]).toEqual([
          { label: 'existing', score: null, tags: null },
        ]);
        expect(byId[2]).toEqual([
          { label: 'present', score: '42', tags: ['red', 'blue'] },
          { label: 'missing-between', score: null, tags: null },
          { label: 'last', score: '7', tags: [] },
        ]);
        expect(byId[3]).toEqual([
          { label: 'omitted', score: null, tags: null },
        ]);
        expect(byId[4]).toEqual([{ label: 'null', score: null, tags: null }]);
        expect(byId[5]).toEqual([{ label: 'empty', score: '0', tags: [] }]);
        expect(byId[6]).toEqual([]);
        if (nullable) expect(byId[7]).toBeNull();
        for (const filter of [
          'MATCH_ANY(items, $[score] == 42)',
          'MATCH_ANY(items, ARRAY_CONTAINS($[tags], "red"))',
        ]) {
          const filtered = await client.query({
            collection_name,
            filter,
            output_fields: ['id'],
          });
          expectSuccess(filtered.status);
          expect(filtered.data.map(row => Number(row.id))).toEqual([2]);
        }

        const search = await client.search({
          collection_name,
          data: [0, 1],
          filter: 'id == 2',
          limit: 1,
          output_fields: ['items'],
        });
        expectSuccess(search.status);
        expect(search.results[0].items).toEqual(byId[2]);

        const elementQuery = {
          collection_name,
          filter: 'element_filter(items, $[score] == 42)',
          output_fields: ['id', 'items[score]', 'items[tags]'],
        };
        const elements = await client.query(elementQuery);
        expectSuccess(elements.status);
        expect(elements.data).toHaveLength(1);
        expect(Number(elements.data[0].id)).toBe(2);
        expect(Number(elements.data[0].offset)).toBe(0);
        const iterator = await client.queryIterator({
          ...elementQuery,
          batchSize: 2,
        });
        const iterated = [];
        for await (const batch of iterator) iterated.push(...batch);
        expect(iterated).toEqual(elements.data);

        expectSuccess(
          (
            await client.upsert({
              collection_name,
              data: [{ id: 2, items: [{ label: 'renamed' }] }],
              field_ops: [
                { field_name: 'items', op: 'PATH_REPLACE', path: '[0][label]' },
              ],
            })
          ).status
        );
        const updated = await client.query({
          collection_name,
          filter: 'id == 2',
          output_fields: ['items'],
        });
        expectSuccess(updated.status);
        expect(updated.data[0].items).toEqual([
          { label: 'renamed', score: '42', tags: ['red', 'blue'] },
          ...byId[2].slice(1),
        ]);

        expectSuccess(
          (
            await client.upsert({
              collection_name,
              data: [{ id: 2, items: [{ score: null }] }],
              field_ops: [
                { field_name: 'items', op: 'PATH_REPLACE', path: '[0][score]' },
              ],
            })
          ).status
        );
        const nullScore = await client.query({
          collection_name,
          filter: 'id == 2',
          output_fields: ['items'],
        });
        expectSuccess(nullScore.status);
        expect(nullScore.data[0].items[0]).toEqual({
          label: 'renamed',
          score: null,
          tags: ['red', 'blue'],
        });

        expectSuccess(
          (
            await client.upsert({
              collection_name,
              data: [
                { id: 2, items: [{ label: 'replacement', score: 10 }] },
                { id: 3, items: [{ label: 'missing-score' }] },
              ],
              field_ops: [
                { field_name: 'items', op: 'PATH_REPLACE', path: '[0]' },
              ],
            })
          ).status
        );
        const replaced = await client.query({
          collection_name,
          filter: 'id in [2, 3]',
          output_fields: ['id', 'items'],
        });
        expectSuccess(replaced.status);
        const replacements = Object.fromEntries(
          replaced.data.map(row => [Number(row.id), row.items])
        );
        expect(replacements[2]).toEqual([
          { label: 'replacement', score: '10', tags: null },
          ...byId[2].slice(1),
        ]);
        expect(replacements[3]).toEqual([
          { label: 'missing-score', score: null, tags: null },
        ]);

        for (const field_name of ['items[score]', 'items[tags]']) {
          expectSuccess(
            await client.dropCollectionField({ collection_name, field_name })
          );
        }
        const afterDrop = await client.describeCollection({ collection_name });
        expectSuccess(afterDrop.status);
        expect(
          afterDrop.schema.fields
            .find(field => field.name === 'items')!
            .fields!.map(field => field.name)
        ).toEqual(['label']);
        expectSuccess(
          (
            await client.insert({
              collection_name,
              data: [
                { id: 8, vector: [1, 0], items: [{ label: 'after-drop' }] },
              ],
            })
          ).status
        );
        const remaining = await client.query({
          collection_name,
          filter: 'id == 8',
          output_fields: ['items'],
        });
        expectSuccess(remaining.status);
        expect(remaining.data[0].items).toEqual([{ label: 'after-drop' }]);
      });
    }
  );
});

// Nullable vector children use VectorField.valid_data inside each struct row.
describe('nullable StructArray vector children', () => {
  const types = [
    DataType.FloatVector,
    DataType.BinaryVector,
    DataType.Float16Vector,
    DataType.BFloat16Vector,
    DataType.Int8Vector,
  ];
  const cases = types.flatMap(data_type =>
    ['create', 'add-child', 'add-struct'].map(mode => ({ data_type, mode }))
  );
  it.each(cases)(
    'round-trips $data_type via $mode',
    async ({ data_type, mode }) => {
      await withCollection(async (client, collection_name) => {
        const value = data_type === DataType.BinaryVector ? [1] : [1, 0];
        const child = {
          name: 'embedding',
          data_type,
          dim: data_type === DataType.BinaryVector ? 8 : 2,
          nullable: true,
        };
        const parent = {
          name: 'items',
          data_type: DataType.Array,
          element_type: DataType.Struct,
          nullable: true,
          max_capacity: 10,
          fields: [
            {
              name: 'label',
              data_type: DataType.VarChar,
              max_length: 32,
              nullable: true,
            },
            ...(mode === 'create' ? [child] : []),
          ],
        };
        expectSuccess(
          await client.createCollection({
            collection_name,
            consistency_level: 'Strong',
            fields: [
              { name: 'id', data_type: DataType.Int64, is_primary_key: true },
              { name: 'vector', data_type: DataType.FloatVector, dim: 2 },
              ...(mode === 'add-struct' ? [] : [parent]),
            ],
          })
        );
        expectSuccess(
          await client.createIndex({
            collection_name,
            field_name: 'vector',
            index_type: IndexType.FLAT,
            metric_type: MetricType.L2,
          })
        );
        if (mode === 'create') {
          expectSuccess(
            await client.createIndex({
              collection_name,
              field_name: 'items[embedding]',
              index_type:
                data_type === DataType.BinaryVector
                  ? IndexType.BIN_FLAT
                  : IndexType.HNSW,
              metric_type:
                data_type === DataType.BinaryVector
                  ? MetricType.HAMMING
                  : MetricType.L2,
              params:
                data_type === DataType.BinaryVector
                  ? {}
                  : { M: 8, efConstruction: 64 },
            })
          );
        }
        expectSuccess(await client.loadCollectionSync({ collection_name }));
        if (mode !== 'create') {
          expectSuccess(
            (
              await client.insert({
                collection_name,
                data: [
                  {
                    id: 0,
                    vector: [1, 0],
                    ...(mode === 'add-child'
                      ? { items: [{ label: 'old' }] }
                      : {}),
                  },
                ],
              })
            ).status
          );
          expectSuccess(
            await client.addCollectionField({
              collection_name,
              field:
                mode === 'add-child'
                  ? { ...child, name: 'items[embedding]' }
                  : { ...parent, fields: [...parent.fields, child] },
            })
          );
        }
        expectSuccess(
          (
            await client.insert({
              collection_name,
              data: [
                {
                  id: 1,
                  vector: [1, 0],
                  items: [
                    { label: 'a', embedding: value },
                    {},
                    { embedding: null },
                    { label: 'b', embedding: value },
                  ],
                },
                { id: 2, vector: [0, 1], items: [{ label: 'all-null' }] },
                { id: 3, vector: [1, 0], items: [] },
                { id: 4, vector: [0, 1], items: null },
              ],
            })
          ).status
        );
        const result = await client.query({
          collection_name,
          filter: 'id >= 0',
          output_fields: ['id', 'items'],
        });
        expectSuccess(result.status);
        const byId = Object.fromEntries(
          result.data.map(row => [Number(row.id), row.items])
        );
        expect(byId[1]).toEqual([
          { label: 'a', embedding: value },
          { label: null, embedding: null },
          { label: null, embedding: null },
          { label: 'b', embedding: value },
        ]);
        expect(byId[2]).toEqual([{ label: 'all-null', embedding: null }]);
        expect(byId[3]).toEqual([]);
        expect(byId[4]).toBeNull();
        if (mode !== 'create')
          expect(byId[0]).toEqual(
            mode === 'add-child' ? [{ label: 'old', embedding: null }] : null
          );
        const search = await client.search({
          collection_name,
          data: [1, 0],
          filter: 'id == 1',
          output_fields: ['items'],
          limit: 1,
        });
        expectSuccess(search.status);
        expect(search.results[0].items).toEqual(byId[1]);
      });
    }
  );
});

it('round-trips an added VarChar and Array with nullable leaves', async () => {
  await withCollection(async (client, collection_name) => {
    expectSuccess(
      await client.createCollection({
        collection_name,
        consistency_level: 'Strong',
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vector', data_type: DataType.FloatVector, dim: 2 },
          {
            name: 'items',
            data_type: DataType.Array,
            element_type: DataType.Struct,
            max_capacity: 10,
            fields: [{ name: 'key', data_type: DataType.Int64 }],
          },
        ],
      })
    );
    expectSuccess(
      await client.createIndex({
        collection_name,
        field_name: 'vector',
        index_type: IndexType.FLAT,
        metric_type: MetricType.L2,
      })
    );
    expectSuccess(await client.loadCollectionSync({ collection_name }));
    for (const field of [
      {
        name: 'items[text]',
        data_type: DataType.VarChar,
        max_length: 32,
        nullable: true,
      },
      {
        name: 'items[tags]',
        data_type: DataType.Array,
        element_type: DataType.VarChar,
        max_capacity: 8,
        max_length: 32,
        nullable: true,
        element_nullable: true,
      },
    ])
      expectSuccess(
        await client.addCollectionField({ collection_name, field })
      );
    expectSuccess(
      (
        await client.insert({
          collection_name,
          data: [
            {
              id: 1,
              vector: [1, 0],
              items: [
                { key: 1, text: 'hello', tags: ['a', null, 'b'] },
                { key: 2 },
                { key: 3, text: '', tags: [] },
              ],
            },
          ],
        })
      ).status
    );
    const result = await client.query({
      collection_name,
      filter: 'MATCH_ANY(items, $[text] == "hello")',
      output_fields: ['items'],
    });
    expectSuccess(result.status);
    expect(result.data[0].items).toEqual([
      { key: '1', text: 'hello', tags: ['a', null, 'b'] },
      { key: '2', text: null, tags: null },
      { key: '3', text: '', tags: [] },
    ]);
  });
});
