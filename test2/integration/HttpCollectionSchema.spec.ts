import {
  ConsistencyLevelEnum,
  DataType,
  HttpClient,
  IndexType,
  MetricType,
} from '../../milvus';
import { GENERATE_NAME, IP } from '../fixtures';
import { expectHttpSuccess, expectSuccess } from '../support/assertions';
import { createClient } from '../support/client';

describe('REST collection schema and truncate', () => {
  const collectionName = GENERATE_NAME('http_schema');
  const collection = { collectionName };
  const client = createClient({ address: IP });
  const http = new HttpClient({ endpoint: `http://${IP}` });

  const describeCollection = async () => {
    const result = await client.describeCollection({
      collection_name: collectionName,
      cache: false,
    });
    expectSuccess(result.status);
    return result.schema;
  };

  beforeAll(async () => {
    expectSuccess(
      await client.createCollection({
        collection_name: collectionName,
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vector', data_type: DataType.FloatVector, dim: 2 },
          {
            name: 'text',
            data_type: DataType.VarChar,
            max_length: 64,
            enable_analyzer: true,
          },
          { name: 'temporary_name', data_type: DataType.Int32, nullable: true },
          { name: 'temporary_id', data_type: DataType.Int32, nullable: true },
        ],
      })
    );
    expectSuccess(
      await client.createIndex({
        collection_name: collectionName,
        field_name: 'vector',
        index_type: IndexType.AUTOINDEX,
        metric_type: MetricType.L2,
      })
    );
  });

  afterAll(async () => {
    await client.dropCollection({ collection_name: collectionName });
  });

  it('adds a StructArray and a bound function field, then drops fields by name and ID', async () => {
    expectHttpSuccess(
      await http.addCollectionStructField({
        ...collection,
        schema: {
          fieldName: 'items',
          dataType: 'Array',
          elementDataType: 'Struct',
          nullable: true,
          typeParams: { max_capacity: 4 },
          fields: [
            {
              fieldName: 'label',
              dataType: 'Array',
              elementDataType: 'VarChar',
              elementTypeParams: { max_length: 32 },
            },
          ],
        },
      })
    );
    const bm25 = {
      name: 'bm25_text',
      type: 'BM25',
      inputFieldNames: ['text'],
      outputFieldNames: ['sparse_text'],
    };
    expectHttpSuccess(
      await http.addFunctionField({
        ...collection,
        function: bm25,
        outputField: {
          fieldName: 'sparse_text',
          dataType: 'SparseFloatVector',
        },
        indexParams: {
          fieldName: 'sparse_text',
          indexType: 'SPARSE_INVERTED_INDEX',
          metricType: 'BM25',
        },
      })
    );

    const extended = await describeCollection();
    expect(extended.fields.map(field => field.name)).toEqual(
      expect.arrayContaining(['items', 'sparse_text'])
    );
    expect(extended.functions.map(item => item.name)).toContain(bm25.name);
    const rejected = await http.alterCollectionFunction({
      ...collection,
      functionName: bm25.name,
      function: bm25,
    });
    expect(rejected.code).not.toBe(0);
    expect(rejected.message).toContain('does not support alter BM25 function');

    const byId = extended.fields.find(field => field.name === 'temporary_id');
    expect(Number(byId?.fieldID)).toBeGreaterThan(0);
    expectHttpSuccess(
      await http.dropCollectionField({
        ...collection,
        fieldName: 'temporary_name',
      })
    );
    expectHttpSuccess(
      await http.dropCollectionField({
        ...collection,
        fieldId: Number(byId!.fieldID),
      })
    );
    expectHttpSuccess(
      await http.dropFunctionField({ ...collection, functionName: bm25.name })
    );

    const reduced = await describeCollection();
    expect(reduced.fields.map(field => field.name).sort()).toEqual([
      'id',
      'items',
      'text',
      'vector',
    ]);
    expect(reduced.functions).toEqual([]);
  });

  it('truncates rows and keeps the collection loaded', async () => {
    expectSuccess(
      await client.insert({
        collection_name: collectionName,
        data: [{ id: 1, text: 'book', vector: [0.1, 0.2] }],
      })
    );
    expectSuccess(
      await client.loadCollectionSync({ collection_name: collectionName })
    );

    const count = async () => {
      const response = await client.count({
        collection_name: collectionName,
        consistency_level: ConsistencyLevelEnum.Strong,
      });
      expectSuccess(response.status);
      return response.data;
    };
    expect(await count()).toBe(1);
    expectHttpSuccess(await http.truncateCollection(collection));
    expect(await count()).toBe(0);
    const schema = await describeCollection();
    expect(schema.fields.map(field => field.name)).toContain('vector');
  });
});
