import {
  DataType,
  ErrorCode,
  findKeyValue,
  IndexType,
  MetricType,
  MilvusClient,
} from '../../milvus';
import { GENERATE_NAME, IP } from '../tools';

jest.setTimeout(180000);

const client = new MilvusClient({ address: IP, logLevel: 'info' });
const COLLECTION_NAME = GENERATE_NAME('struct_array_advanced');
const NESTED_ARRAY_COLLECTION = GENERATE_NAME('struct_array_nested');
const DB_NAME = GENERATE_NAME('struct_array_advanced_db');
const DIM = 8;
const BACKGROUND_ROWS = 1200;

const unitVector = (axis: number) =>
  Array.from({ length: DIM }, (_, index) => (index === axis ? 1 : 0));

const vectorFor = (seed: number) => {
  const angle = ((seed % 100) / 100) * (Math.PI / 2);
  return [
    Math.cos(angle),
    Math.sin(angle),
    ...Array.from({ length: DIM - 2 }, () => 0),
  ];
};

const sharedStructFields = [
  { name: 'embedding', data_type: DataType.FloatVector, dim: DIM },
  { name: 'label', data_type: DataType.VarChar, max_length: 64 },
  { name: 'score', data_type: DataType.Int32 },
];

const waitForField = async (fieldName: string) => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const describe = await client.describeCollection({
      collection_name: COLLECTION_NAME,
      cache: false,
    });
    const field = describe.schema.fields.find(item => item.name === fieldName);
    if (field) {
      return field;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for field ${fieldName}`);
};

const drain = async (iterator: any) => {
  const rows: any[] = [];
  for await (const batch of iterator) {
    rows.push(...batch);
  }
  return rows;
};

describe('StructArray advanced integration', () => {
  beforeAll(async () => {
    const createDatabase = await client.createDatabase({ db_name: DB_NAME });
    expect(createDatabase.error_code).toEqual(ErrorCode.SUCCESS);
    await client.use({ db_name: DB_NAME });

    const create = await client.createCollection({
      collection_name: COLLECTION_NAME,
      consistency_level: 'Strong',
      fields: [
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: false,
        },
        {
          name: 'normal_vector',
          data_type: DataType.FloatVector,
          dim: DIM,
        },
        {
          name: 'nullable_text',
          data_type: DataType.VarChar,
          max_length: 64,
          nullable: true,
        },
        {
          name: 'nullable_numbers',
          data_type: DataType.Array,
          element_type: DataType.Int32,
          max_capacity: 4,
          nullable: true,
        },
        {
          name: 'nullable_json',
          data_type: DataType.JSON,
          nullable: true,
        },
        {
          name: 'image_features',
          data_type: DataType.Array,
          element_type: DataType.Struct,
          max_capacity: 4,
          nullable: true,
          fields: sharedStructFields,
        },
        {
          name: 'text_features',
          data_type: DataType.Array,
          element_type: DataType.Struct,
          max_capacity: 4,
          nullable: true,
          fields: sharedStructFields,
        },
      ],
    });
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const oldInsert = await client.insert({
      collection_name: COLLECTION_NAME,
      data: [
        {
          id: 0,
          normal_vector: unitVector(0),
          nullable_text: null,
          nullable_numbers: null,
          nullable_json: null,
          image_features: null,
          text_features: [
            {
              embedding: unitVector(1),
              label: 'old-text',
              score: 1,
            },
          ],
        },
      ],
    });
    if (oldInsert.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(
        `Initial insert failed: ${JSON.stringify(oldInsert.status)}`
      );
    }
    await client.flushSync({ collection_names: [COLLECTION_NAME] });

    const addField = await client.addCollectionField({
      collection_name: COLLECTION_NAME,
      field: {
        name: 'profile',
        description: 'dynamically added nullable struct array',
        data_type: DataType.Array,
        element_type: DataType.Struct,
        max_capacity: 4,
        nullable: true,
        fields: [
          { name: 'score', data_type: DataType.Int64 },
          { name: 'tag', data_type: DataType.VarChar, max_length: 32 },
          { name: 'rank', data_type: DataType.Int32 },
          { name: 'active', data_type: DataType.Bool },
          { name: 'embedding', data_type: DataType.FloatVector, dim: DIM },
        ],
      },
    });
    expect(addField.error_code).toEqual(ErrorCode.SUCCESS);
    await waitForField('profile');

    const rows: any[] = [
      {
        id: 1,
        normal_vector: unitVector(0),
        nullable_text: 'quoted "element_filter(profile, value)',
        nullable_numbers: [1, 2],
        nullable_json: { kind: 'object' },
        image_features: [
          {
            embedding: unitVector(0),
            label: 'image-one',
            score: 11,
          },
        ],
        text_features: [
          {
            embedding: unitVector(1),
            label: 'text-one',
            score: 101,
          },
        ],
        profile: [
          {
            score: 900000,
            tag: 'hot',
            rank: 1,
            active: true,
            embedding: unitVector(0),
          },
          {
            score: 900001,
            tag: 'hot',
            rank: 2,
            active: false,
            embedding: vectorFor(5),
          },
          {
            score: 900002,
            tag: 'hot',
            rank: 3,
            active: true,
            embedding: vectorFor(10),
          },
        ],
      },
    ];

    for (let id = 2; id < BACKGROUND_ROWS + 2; id++) {
      rows.push({
        id,
        normal_vector: vectorFor(id + 31),
        nullable_text: `text-${id}`,
        nullable_numbers: [id],
        nullable_json: { id },
        image_features: [
          {
            embedding: vectorFor(id),
            label: `image-${id}`,
            score: id,
          },
        ],
        text_features: [
          {
            embedding: vectorFor(id + 17),
            label: `text-${id}`,
            score: id + 10000,
          },
        ],
        profile: [
          {
            score: id,
            tag: id % 2 === 0 ? 'even' : 'odd',
            rank: id % 10,
            active: id % 2 === 0,
            embedding: vectorFor(id + 7),
          },
        ],
      });
    }

    rows.push(
      {
        id: BACKGROUND_ROWS + 2,
        normal_vector: unitVector(2),
        nullable_text: null,
        nullable_numbers: null,
        nullable_json: null,
        image_features: null,
        text_features: null,
        profile: null,
      },
      {
        id: BACKGROUND_ROWS + 3,
        normal_vector: unitVector(3),
        nullable_text: '',
        nullable_numbers: [],
        nullable_json: {},
        image_features: [],
        text_features: [],
        profile: [],
      }
    );

    const insert = await client.insert({
      collection_name: COLLECTION_NAME,
      data: rows,
    });
    if (insert.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Bulk insert failed: ${JSON.stringify(insert.status)}`);
    }
    expect(insert.succ_index).toHaveLength(rows.length);
    await client.flushSync({ collection_names: [COLLECTION_NAME] });

    const indexes = await client.createIndex([
      {
        collection_name: COLLECTION_NAME,
        index_name: 'normal_vector_flat',
        field_name: 'normal_vector',
        index_type: IndexType.FLAT,
        metric_type: MetricType.COSINE,
      },
      {
        collection_name: COLLECTION_NAME,
        index_name: 'profile_embedding_diskann',
        field_name: 'profile[embedding]',
        index_type: IndexType.DISKANN,
        metric_type: MetricType.COSINE,
      },
      {
        collection_name: COLLECTION_NAME,
        index_name: 'profile_score_stl_sort',
        field_name: 'profile[score]',
        index_type: IndexType.STL_SORT,
      },
      {
        collection_name: COLLECTION_NAME,
        index_name: 'profile_tag_bitmap',
        field_name: 'profile[tag]',
        index_type: IndexType.BITMAP,
      },
      {
        collection_name: COLLECTION_NAME,
        index_name: 'profile_rank_inverted',
        field_name: 'profile[rank]',
        index_type: IndexType.INVERTED,
      },
      {
        collection_name: COLLECTION_NAME,
        index_name: 'image_embedding_flat',
        field_name: 'image_features[embedding]',
        index_type: IndexType.FLAT,
        metric_type: MetricType.COSINE,
      },
      {
        collection_name: COLLECTION_NAME,
        index_name: 'text_embedding_flat',
        field_name: 'text_features[embedding]',
        index_type: IndexType.FLAT,
        metric_type: MetricType.COSINE,
      },
    ]);
    expect(indexes.error_code).toEqual(ErrorCode.SUCCESS);

    const load = await client.loadCollection({
      collection_name: COLLECTION_NAME,
      timeout: 120000,
    });
    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  afterAll(async () => {
    await client
      .dropCollection({ collection_name: COLLECTION_NAME })
      .catch(() => undefined);
    await client
      .dropCollection({ collection_name: NESTED_ARRAY_COLLECTION })
      .catch(() => undefined);
    await client.dropDatabase({ db_name: DB_NAME }).catch(() => undefined);
  });

  it('supports duplicate child names, nullable rows, and dynamic StructArray fields', async () => {
    const describe = await client.describeCollection({
      collection_name: COLLECTION_NAME,
      cache: false,
    });
    const profile = describe.schema.fields.find(
      field => field.name === 'profile'
    );
    expect(profile).toMatchObject({
      data_type: 'Array',
      element_type: 'Struct',
      nullable: true,
      max_capacity: '4',
    });
    expect(profile!.fields!.map(field => field.name)).toEqual([
      'score',
      'tag',
      'rank',
      'active',
      'embedding',
    ]);

    const result = await client.query({
      collection_name: COLLECTION_NAME,
      filter: `id in [0, 1, ${BACKGROUND_ROWS + 2}, ${BACKGROUND_ROWS + 3}]`,
      output_fields: [
        'id',
        'image_features[label]',
        'image_features[score]',
        'text_features[label]',
        'text_features[score]',
        'profile',
        'nullable_text',
        'nullable_numbers',
        'nullable_json',
      ],
      limit: 10,
    });
    expect(result.status.error_code).toEqual(ErrorCode.SUCCESS);
    const byId = new Map(result.data.map(row => [Number(row.id), row]));

    expect(byId.get(0)!.profile).toBeNull();
    expect(byId.get(0)!.image_features).toBeNull();
    expect(byId.get(0)!.nullable_text).toBeNull();
    expect(byId.get(0)!.nullable_numbers).toBeNull();
    expect(byId.get(0)!.nullable_json).toBeNull();
    expect(byId.get(1)!.image_features[0]).toMatchObject({
      label: 'image-one',
      score: 11,
    });
    expect(byId.get(1)!.text_features[0]).toMatchObject({
      label: 'text-one',
      score: 101,
    });
    expect(byId.get(1)!.nullable_text).toEqual(
      'quoted "element_filter(profile, value)'
    );
    expect(byId.get(1)!.nullable_numbers).toEqual([1, 2]);
    expect(byId.get(1)!.nullable_json).toEqual({ kind: 'object' });
    expect(byId.get(BACKGROUND_ROWS + 2)!.profile).toBeNull();
    expect(byId.get(BACKGROUND_ROWS + 2)!.nullable_text).toBeNull();
    expect(byId.get(BACKGROUND_ROWS + 2)!.nullable_numbers).toBeNull();
    expect(byId.get(BACKGROUND_ROWS + 2)!.nullable_json).toBeNull();
    expect(byId.get(BACKGROUND_ROWS + 3)!.profile).toEqual([]);
    expect(byId.get(BACKGROUND_ROWS + 3)!.nullable_text).toEqual('');
    expect(byId.get(BACKGROUND_ROWS + 3)!.nullable_numbers).toEqual([]);
    expect(byId.get(BACKGROUND_ROWS + 3)!.nullable_json).toEqual({});
  });

  it('requires nullable struct arrays for dynamic fields', async () => {
    await expect(
      client.addCollectionField({
        collection_name: COLLECTION_NAME,
        field: {
          name: 'invalid_profile',
          data_type: DataType.Array,
          element_type: DataType.Struct,
          max_capacity: 2,
          fields: [{ name: 'score', data_type: DataType.Int64 }],
        },
      })
    ).rejects.toThrow(
      'Adding a struct array field to an existing collection requires nullable=true.'
    );
  });

  it('treats element_filter text inside quoted values as plain text', async () => {
    const iterator = await client.queryIterator({
      collection_name: COLLECTION_NAME,
      filter: 'nullable_text == "quoted \\"element_filter(profile, value)"',
      output_fields: ['id', 'nullable_text'],
      batchSize: 1,
      limit: 1,
    });
    const rows = await drain(iterator);

    expect(rows).toHaveLength(1);
    expect(Number(rows[0].id)).toBe(1);
    expect(rows[0].nullable_text).toBe(
      'quoted "element_filter(profile, value)'
    );
  });

  it('reports DISKANN, STL_SORT, Bitmap, and scalar indexes on struct children', async () => {
    const expectedIndexes = [
      ['profile_embedding_diskann', IndexType.DISKANN],
      ['profile_score_stl_sort', IndexType.STL_SORT],
      ['profile_tag_bitmap', IndexType.BITMAP],
      ['profile_rank_inverted', IndexType.INVERTED],
    ];

    for (const [indexName, indexType] of expectedIndexes) {
      const describe = await client.describeIndex({
        collection_name: COLLECTION_NAME,
        index_name: indexName,
      });
      expect(describe.status.error_code).toEqual(ErrorCode.SUCCESS);
      expect(
        findKeyValue(describe.index_descriptions[0].params, 'index_type')
      ).toEqual(indexType);
    }
  });

  it('supports MATCH family filters with indexed struct children', async () => {
    const queryIds = async (matchExpr: string) => {
      const result = await client.query({
        collection_name: COLLECTION_NAME,
        filter: `id in [1, 2] && ${matchExpr}`,
        output_fields: ['id'],
        limit: 10,
      });
      expect(result.status.error_code).toEqual(ErrorCode.SUCCESS);
      return result.data
        .map(row => Number(row.id))
        .sort((left, right) => left - right);
    };

    expect(await queryIds('MATCH_ANY(profile, $[tag] == "hot")')).toEqual([1]);
    expect(await queryIds('MATCH_ALL(profile, $[score] >= 900000)')).toEqual([
      1,
    ]);
    expect(
      await queryIds('MATCH_LEAST(profile, $[rank] >= 2, threshold=2)')
    ).toEqual([1]);
    expect(
      await queryIds('MATCH_MOST(profile, $[rank] >= 2, threshold=1)')
    ).toEqual([2]);
    expect(
      await queryIds('MATCH_EXACT(profile, $[rank] >= 2, threshold=2)')
    ).toEqual([1]);

    const search = await client.search({
      collection_name: COLLECTION_NAME,
      anns_field: 'normal_vector',
      data: unitVector(0),
      filter: 'id in [1, 2] && MATCH_ANY(profile, $[tag] == "hot")',
      output_fields: ['id'],
      limit: 10,
    });
    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.map(hit => Number(hit.id))).toEqual([1]);
  });

  it('rejects nested Array children with the server limitation', async () => {
    await expect(
      client.createCollection({
        collection_name: NESTED_ARRAY_COLLECTION,
        fields: [
          {
            name: 'id',
            data_type: DataType.Int64,
            is_primary_key: true,
          },
          {
            name: 'vector',
            data_type: DataType.FloatVector,
            dim: DIM,
          },
          {
            name: 'items',
            data_type: DataType.Array,
            element_type: DataType.Struct,
            max_capacity: 4,
            fields: [
              {
                name: 'nested',
                data_type: DataType.Array,
                element_type: DataType.Int64,
                max_capacity: 2,
              },
            ],
          },
        ],
      })
    ).rejects.toMatchObject({
      error_code: ErrorCode.IllegalArgument,
      reason: expect.stringMatching(/nested array is not supported/i),
    });
  });

  it('supports element-level filter, query, and same-named struct paths', async () => {
    const query = await client.query({
      collection_name: COLLECTION_NAME,
      filter: 'element_filter(profile, $[score] >= 900000)',
      output_fields: ['id', 'profile[score]', 'profile[tag]'],
      limit: 10,
    });
    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(query.data).toHaveLength(3);
    expect(query.data.map(row => Number(row.id))).toEqual([1, 1, 1]);
    expect(query.data.map(row => Number(row.offset))).toEqual([0, 1, 2]);

    const imageSearch = await client.search({
      collection_name: COLLECTION_NAME,
      anns_field: 'image_features[embedding]',
      data: unitVector(0),
      filter: 'id == 1',
      output_fields: ['id', 'image_features[label]', 'text_features[label]'],
      limit: 1,
    });
    expect(imageSearch.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(imageSearch.results[0]).toMatchObject({ id: '1', offset: '0' });
    expect(imageSearch.results[0].image_features[0].label).toEqual('image-one');
    expect(imageSearch.results[0].text_features[0].label).toEqual('text-one');

    const textSearch = await client.search({
      collection_name: COLLECTION_NAME,
      anns_field: 'text_features[embedding]',
      data: unitVector(1),
      filter: 'id == 1',
      output_fields: ['id', 'text_features[label]'],
      limit: 1,
    });
    expect(textSearch.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(textSearch.results[0]).toMatchObject({ id: '1', offset: '0' });
    expect(textSearch.results[0].text_features[0].label).toEqual('text-one');
  });

  it('supports element-level search, group_by, and range search', async () => {
    const search = await client.search({
      collection_name: COLLECTION_NAME,
      anns_field: 'profile[embedding]',
      data: vectorFor(5),
      filter: 'element_filter(profile, $[score] == 900001)',
      output_fields: ['id', 'profile[score]', 'profile[tag]'],
      limit: 1,
    });
    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results[0]).toMatchObject({ id: '1', offset: '1' });

    const grouped = await client.search({
      collection_name: COLLECTION_NAME,
      anns_field: 'profile[embedding]',
      data: unitVector(0),
      filter: 'element_filter(profile, $[score] >= 0)',
      group_by_field: 'id',
      output_fields: ['id'],
      limit: 10,
    });
    expect(grouped.status.error_code).toEqual(ErrorCode.SUCCESS);
    const groupedIds = grouped.results.map((hit: any) => hit.id);
    expect(new Set(groupedIds).size).toEqual(groupedIds.length);

    const range = await client.search({
      collection_name: COLLECTION_NAME,
      anns_field: 'profile[embedding]',
      data: unitVector(0),
      filter: 'element_filter(profile, $[score] >= 900000)',
      params: { radius: 0.98, range_filter: 1.01 },
      output_fields: ['id', 'profile[score]'],
      limit: 10,
    });
    expect(range.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(range.results.length).toBeGreaterThan(0);
    range.results.forEach((hit: any) => {
      expect(hit.id).toEqual('1');
      expect(hit.score).toBeGreaterThanOrEqual(0.98);
      expect(hit.score).toBeLessThan(1.01);
    });
  });

  it('supports element-level hybrid search with a normal vector request', async () => {
    const result = await client.hybridSearch({
      collection_name: COLLECTION_NAME,
      data: [
        {
          anns_field: 'profile[embedding]',
          data: unitVector(0),
          expr: 'element_filter(profile, $[score] >= 900000)',
          limit: 3,
        },
        {
          anns_field: 'normal_vector',
          data: unitVector(0),
          expr: 'id == 1',
          limit: 3,
        },
      ],
      output_fields: ['id'],
      limit: 3,
    });

    expect(result.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(result.results[0].id).toEqual('1');
    expect(result.results[0].offset).toBeUndefined();
  });

  it('supports element-level search and query iterators without losing offsets', async () => {
    const zeroPrimaryKeyIterator = await client.queryIterator({
      collection_name: COLLECTION_NAME,
      filter: 'id >= 0',
      output_fields: ['id'],
      batchSize: 1,
      limit: 2,
    });
    const zeroPrimaryKeyRows = await drain(zeroPrimaryKeyIterator);
    expect(zeroPrimaryKeyRows.map(row => Number(row.id))).toEqual([0, 1]);

    const searchIterator = await client.searchIterator({
      collection_name: COLLECTION_NAME,
      anns_field: 'profile[embedding]',
      data: unitVector(0),
      filter: 'element_filter(profile, $[score] >= 900000)',
      output_fields: ['id', 'profile[score]'],
      batchSize: 1,
      limit: 3,
    });
    const searchRows = await drain(searchIterator);
    expect(searchRows).toHaveLength(3);
    expect(
      new Set(searchRows.map(row => `${row.id}:${row.offset}`)).size
    ).toEqual(3);

    const queryIterator = await client.queryIterator({
      collection_name: COLLECTION_NAME,
      filter: 'element_filter(profile, $[score] >= 900000)',
      output_fields: ['id', 'profile[score]'],
      batchSize: 1,
      limit: 3,
    });
    const queryRows = await drain(queryIterator);
    expect(queryRows.map(row => Number(row.id))).toEqual([1, 1, 1]);
    expect(queryRows.map(row => Number(row.offset))).toEqual([0, 1, 2]);

    const growingID = BACKGROUND_ROWS + 4;
    const growingInsert = await client.insert({
      collection_name: COLLECTION_NAME,
      data: [
        {
          id: growingID,
          normal_vector: unitVector(4),
          nullable_text: null,
          nullable_numbers: null,
          nullable_json: null,
          image_features: null,
          text_features: null,
          profile: null,
        },
      ],
    });
    expect(growingInsert.status.error_code).toEqual(ErrorCode.SUCCESS);

    const ignoreGrowingIterator = await client.queryIterator({
      collection_name: COLLECTION_NAME,
      filter: `id == ${growingID}`,
      output_fields: ['id'],
      params: { ignore_growing: true },
      batchSize: 1,
    });
    const emptyPage =
      await ignoreGrowingIterator[Symbol.asyncIterator]().next();
    expect(emptyPage).toEqual({ done: true, value: null });
  });
});
