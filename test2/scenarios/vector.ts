import { DataType, IndexType } from '../../milvus';
import { collectionSchema, generateInsertData } from '../fixtures';
import { VectorCase } from '../fixtures/vectors';
import { expectSuccess, step, withCollection } from '../support/scenario';

/** The same observable contract applies to every supported vector representation. */
export async function vectorScenario(
  fixture: VectorCase,
  primary: DataType.Int64 | DataType.VarChar
) {
  await withCollection(async (client, collection_name) => {
    const isString = primary === DataType.VarChar;
    const ids = [1, 2, 3].map(id => (isString ? String(id) : id));
    const filter = (index: number) => `id == ${JSON.stringify(ids[index])}`;
    const binary = fixture.type === DataType.BinaryVector;
    const schema = collectionSchema({
      collectionName: collection_name,
      idType: primary,
      autoID: false,
      vectorType: binary ? [fixture.type, fixture.type] : [fixture.type],
      dim: binary ? [fixture.dim, fixture.dim] : [fixture.dim],
    });
    const data = generateInsertData(schema.fields, 3).map((row, i) => ({
      ...row,
      id: ids[i],
      int64: 100 + i,
      vector: fixture.input(i),
      ...(binary
        ? {
            vector1: [
              [0x0f, 0xf0],
              [0x33, 0xcc],
              [0x56, 0x78],
            ][i],
          }
        : {}),
    }));
    await step(`create wide schema / ${fixture.name}`, async () => {
      expectSuccess(await client.createCollection(schema));
      const describe = await client.describeCollection({ collection_name });
      expectSuccess(describe);
      expect(
        describe.schema.fields.filter(
          field => field.data_type === DataType[fixture.type]
        )
      ).toHaveLength(binary ? 2 : 1);
    });
    await step('insert, index and load', async () => {
      const inserted = await client.insert({ collection_name, data });
      expectSuccess(inserted);
      expect(inserted.succ_index).toHaveLength(data.length);
      const params =
        fixture.index === IndexType.HNSW
          ? { M: 16, efConstruction: 200 }
          : fixture.index === IndexType.BIN_IVF_FLAT
            ? { nlist: 10 }
            : fixture.index === IndexType.SPARSE_WAND
              ? { inverted_index_algo: 'DAAT_MAXSCORE' }
              : {};
      expectSuccess(
        await client.createIndex(
          (binary ? ['vector', 'vector1'] : ['vector']).map(field_name => ({
            collection_name,
            field_name,
            index_type: fixture.index,
            metric_type: fixture.metric,
            params,
          }))
        )
      );
      expectSuccess(await client.loadCollectionSync({ collection_name }));
    });
    await step('round-trip vectors by primary key against input', async () => {
      const count = await client.count({ collection_name });
      expectSuccess(count);
      expect(count.data).toBe(3);
      const result = await client.query({
        collection_name,
        filter: isString ? 'id != ""' : 'id > 0',
        output_fields: ['*'],
      });
      expectSuccess(result);
      expect(result.data).toHaveLength(3);
      for (let i = 0; i < data.length; i++) {
        const actual = result.data.find(
          row => String(row.id) === String(ids[i])
        )!;
        const expected = fixture.expected(i);
        if (fixture.precision !== undefined && Array.isArray(expected)) {
          expect(actual.vector).toHaveLength(expected.length);
          expected.forEach((value, dimension) =>
            expect(actual.vector[dimension]).toBeCloseTo(
              value,
              fixture.precision
            )
          );
        } else expect(actual.vector).toEqual(expected);
        if (binary) expect(actual.vector1).toEqual(data[i].vector1);
        expect(Number(actual.int64)).toBe(100 + i);
      }
    });
    await step('filtered search and batched search', async () => {
      for (let i = 0; i < 3; i++) {
        const result = await client.search({
          collection_name,
          anns_field: 'vector',
          data: fixture.input(i),
          filter: filter(i),
          output_fields: ['id', 'vector', ...(binary ? ['vector1'] : [])],
          limit: 3,
          params: binary
            ? { nprobe: 10 }
            : fixture.type === DataType.SparseFloatVector
              ? { drop_ratio_search: 0.2, dim_max_score_ratio: 0.9 }
              : {},
        });
        expectSuccess(result);
        expect(result.results).toHaveLength(1);
        expect(String(result.results[0].id)).toBe(String(ids[i]));
        if (binary) {
          expect(result.results[0].score).toBe(0);
          expect(result.results[0].vector1).toEqual(data[i].vector1);
        }
      }
      const batch = await client.search({
        collection_name,
        nq: 2,
        anns_field: 'vector',
        data: [fixture.input(0), fixture.input(1)],
        output_fields: ['id'],
        limit: 3,
      });
      expectSuccess(batch);
      expect(batch.results).toHaveLength(2);
      for (const results of batch.results) expect(results).toHaveLength(3);
    });
    await step(
      'partial update preserves vectors; delete changes visible IDs',
      async () => {
        expectSuccess(
          await client.upsert({
            collection_name,
            partial_update: true,
            data: [{ id: ids[1], int64: 999 }],
          })
        );
        const updated = await client.query({
          collection_name,
          filter: filter(1),
          output_fields: ['id', 'int64', 'vector'],
        });
        expectSuccess(updated);
        expect(Number(updated.data[0].int64)).toBe(999);
        const expected = fixture.expected(1);
        if (fixture.precision === undefined)
          expect(updated.data[0].vector).toEqual(expected);
        else
          (expected as number[]).forEach((value, i) =>
            expect(updated.data[0].vector[i]).toBeCloseTo(
              value,
              fixture.precision
            )
          );
        expectSuccess(
          await client.delete({ collection_name, filter: filter(0) })
        );
        const remaining = await client.query({
          collection_name,
          filter: isString ? 'id != ""' : 'id > 0',
          output_fields: ['id'],
        });
        expectSuccess(remaining);
        expect(remaining.data.map(row => String(row.id)).sort()).toEqual(
          ids.slice(1).map(String)
        );
      }
    );
  });
}
