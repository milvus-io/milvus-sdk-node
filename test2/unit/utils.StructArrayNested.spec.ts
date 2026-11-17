import path from 'path';
import protobuf from 'protobufjs';
import {
  DataType,
  TypeSchema,
  buildFieldData,
  buildStructArraySubFieldTypeSchema,
  decodeArrayScalarField,
  encodeTypedArrayNode,
  formatCollectionSchema,
  formatDescribedCol,
  formatStructArraySubField,
  processStructArraysData,
  _Field,
} from '../../milvus';

// Array sub-fields inside a StructArray field (Milvus 3.0.6+, milvus#54975):
// posts: Array<Struct{ post_id: VarChar, tags: Array<VarChar> }>

const schemaProto = protobuf.loadSync(
  path.resolve(__dirname, '../../proto/proto/schema.proto')
);
const schemaTypes = {
  collectionSchemaType: schemaProto.lookupType(
    'milvus.proto.schema.CollectionSchema'
  ),
  fieldSchemaType: schemaProto.lookupType('milvus.proto.schema.FieldSchema'),
  functionSchemaType: schemaProto.lookupType(
    'milvus.proto.schema.FunctionSchema'
  ),
  structArrayFieldSchemaType: schemaProto.lookupType(
    'milvus.proto.schema.StructArrayFieldSchema'
  ),
};

const postsField = (tags: Record<string, any> = {}) => ({
  name: 'posts',
  data_type: DataType.Array,
  element_type: DataType.Struct,
  max_capacity: 5,
  fields: [
    { name: 'post_id', data_type: DataType.VarChar, max_length: 16 },
    {
      name: 'tags',
      data_type: DataType.Array,
      element_type: DataType.VarChar,
      max_capacity: 4,
      max_length: 16,
      ...tags,
    },
  ],
});

// round-trip the create payload through the real proto, as the wire does
const encodeCreateSchema = (posts: any) => {
  const payload = formatCollectionSchema(
    {
      collection_name: 'nested',
      fields: [
        { name: 'id', data_type: DataType.Int64, is_primary_key: true },
        { name: 'v', data_type: DataType.FloatVector, dim: 2 },
        posts,
      ],
    },
    schemaTypes
  );
  const message = schemaTypes.collectionSchemaType.create(payload);
  const bytes = schemaTypes.collectionSchemaType.encode(message).finish();
  return schemaTypes.collectionSchemaType.toObject(
    schemaTypes.collectionSchemaType.decode(bytes),
    { enums: String, defaults: false }
  ) as any;
};

const describedTypeSchema = (
  leafType: keyof typeof DataType,
  options: { leafParams?: any[]; inner?: boolean; leaf?: boolean } = {}
): TypeSchema => ({
  kind: 'array_element',
  type_params: [{ key: 'max_capacity', value: '5' }],
  nullable: false,
  array_element: {
    kind: 'array_element',
    type_params: [{ key: 'max_capacity', value: '4' }],
    nullable: !!options.inner,
    array_element: {
      kind: 'leaf_type',
      leaf_type: leafType,
      type_params: options.leafParams || [],
      nullable: !!options.leaf,
    },
  },
});

describe('StructArray Array sub-fields', () => {
  describe('create schema', () => {
    it('sends a nested type_schema like pymilvus', () => {
      const schema = encodeCreateSchema(postsField());
      const [postId, tags] = schema.structArrayFields[0].fields;

      // scalar sub-field unchanged
      expect(postId).toMatchObject({
        name: 'post_id',
        dataType: 'Array',
        elementType: 'VarChar',
      });
      expect(postId.typeSchema).toBeUndefined();

      expect(tags).toMatchObject({
        name: 'tags',
        dataType: 'Array',
        elementType: 'Array',
        typeParams: [{ key: 'max_capacity', value: '5' }],
        typeSchema: {
          typeParams: [{ key: 'max_capacity', value: '5' }],
          arrayElement: {
            typeParams: [{ key: 'max_capacity', value: '4' }],
            arrayElement: {
              leafType: 'VarChar',
              typeParams: [{ key: 'max_length', value: '16' }],
            },
          },
        },
      });
      expect(tags.elementNullable).toBeUndefined();
    });

    it('maps nullable, element_nullable and type_params input forms', () => {
      const schema = encodeCreateSchema({
        ...postsField(),
        nullable: true,
        fields: [
          {
            name: 'nums',
            data_type: 'Array',
            element_type: 'Int64',
            type_params: { max_capacity: 3, 'mmap.enabled': 'true' },
            nullable: true,
            element_nullable: true,
          },
        ],
      });
      const nums = schema.structArrayFields[0].fields[0];
      expect(nums.nullable).toBe(true);
      expect(nums.elementNullable).toBe(true);
      expect(nums.typeParams).toEqual([
        { key: 'mmap.enabled', value: 'true' },
        { key: 'max_capacity', value: '5' },
      ]);
      expect(nums.typeSchema).toEqual({
        nullable: true,
        typeParams: [{ key: 'max_capacity', value: '5' }],
        arrayElement: {
          nullable: true,
          typeParams: [{ key: 'max_capacity', value: '3' }],
          arrayElement: { leafType: 'Int64', nullable: true },
        },
      });
    });

    it('rejects incomplete or unsupported Array sub-fields', () => {
      const base = {
        name: 'tags',
        data_type: DataType.Array,
        max_capacity: 4,
      };
      expect(() => buildStructArraySubFieldTypeSchema(base, 5, false)).toThrow(
        'element_type is required for Array sub-field tags'
      );
      expect(() =>
        buildStructArraySubFieldTypeSchema(
          { ...base, element_type: DataType.Struct },
          5,
          false
        )
      ).toThrow('only supports scalar element types');
      expect(() =>
        buildStructArraySubFieldTypeSchema(
          { ...base, element_type: DataType.Array },
          5,
          false
        )
      ).toThrow('only supports scalar element types');
      expect(() =>
        buildStructArraySubFieldTypeSchema(
          {
            name: 'tags',
            data_type: DataType.Array,
            element_type: DataType.VarChar,
          },
          5,
          false
        )
      ).toThrow('max_capacity is required for Array sub-field tags');
    });

    it('omits the struct capacity when it is not set', () => {
      expect(
        buildStructArraySubFieldTypeSchema(
          {
            name: 'tags',
            data_type: DataType.Array,
            element_type: DataType.Bool,
            max_capacity: 2,
          },
          undefined,
          false
        )
      ).toEqual({
        nullable: false,
        typeParams: [],
        arrayElement: {
          nullable: false,
          typeParams: [{ key: 'max_capacity', value: '2' }],
          arrayElement: {
            leafType: DataType.Bool,
            nullable: false,
            typeParams: [],
          },
        },
      });
    });
  });

  describe('describe', () => {
    const describedTags = () => ({
      name: 'tags',
      data_type: 'Array',
      type_params: [{ key: 'max_capacity', value: '5' }],
      type_schema: describedTypeSchema('VarChar', {
        leafParams: [{ key: 'max_length', value: '16' }],
      }),
    });

    it('exposes element type and own limits of an Array sub-field', () => {
      const res = formatDescribedCol({
        schema: {
          fields: [],
          struct_array_fields: [
            {
              name: 'posts',
              type_params: [{ key: 'max_capacity', value: '5' }],
              fields: [
                {
                  name: 'post_id',
                  data_type: 'Array',
                  element_type: 'VarChar',
                  type_params: [
                    { key: 'max_length', value: '16' },
                    { key: 'max_capacity', value: '5' },
                  ],
                  type_schema: null,
                },
                describedTags(),
              ],
            },
          ],
        },
      } as any);
      const posts: any = res.schema.fields[0];
      const [postId, tags] = posts.fields;

      expect(posts.max_capacity).toBe('5');
      expect(postId).toMatchObject({ data_type: 'VarChar', max_length: '16' });
      expect(tags).toMatchObject({
        data_type: 'Array',
        dataType: DataType.Array,
        element_type: 'VarChar',
        elementType: DataType.VarChar,
        max_capacity: '4',
        max_length: '16',
        type_params: [
          { key: 'max_capacity', value: '4' },
          { key: 'max_length', value: '16' },
        ],
      });
      expect(res.scalar_fields['posts[tags]']).toBe(tags);
    });

    it('adds own limits when the sub-field has no type_params', () => {
      const field: any = {
        name: 'tags',
        type_schema: describedTypeSchema('VarChar', {
          leafParams: [{ key: 'max_length', value: '8' }],
        }),
      };
      formatStructArraySubField(field);
      expect(field.type_params).toEqual([
        { key: 'max_capacity', value: '4' },
        { key: 'max_length', value: '8' },
      ]);
    });

    it('leaves fields without a nested type_schema untouched', () => {
      const field: any = { name: 'x', data_type: 'VarChar', type_schema: null };
      formatStructArraySubField(field);
      expect(field).toEqual({
        name: 'x',
        data_type: 'VarChar',
        type_schema: null,
      });

      const noLimits: any = {
        name: 'flags',
        data_type: 'Array',
        type_schema: {
          array_element: { array_element: { leaf_type: 'Bool' } },
        },
      };
      formatStructArraySubField(noLimits);
      expect(noLimits).toEqual({
        name: 'flags',
        data_type: 'Array',
        dataType: DataType.Array,
        _placeholderType: DataType.Array,
        element_type: 'Bool',
        elementType: DataType.Bool,
        nullable: false,
        element_nullable: false,
        type_schema: noLimits.type_schema,
      });
    });

    it('reports nullability with the same meaning as create', () => {
      // server values: nullable = struct row, element_nullable = sub-array
      const field: any = {
        name: 'nums',
        data_type: 'Array',
        nullable: true,
        element_nullable: false,
        type_schema: describedTypeSchema('Int64', { leaf: true }),
      };
      formatStructArraySubField(field);
      expect(field).toMatchObject({ nullable: false, element_nullable: true });

      const inner: any = {
        name: 'tags',
        nullable: false,
        type_schema: describedTypeSchema('VarChar', { inner: true }),
      };
      formatStructArraySubField(inner);
      expect(inner).toMatchObject({ nullable: true, element_nullable: false });
    });
  });

  describe('write', () => {
    it('encodes one nested array_data per struct row', () => {
      const typeSchema = describedTypeSchema('VarChar');
      expect(
        encodeTypedArrayNode([['a', 'b'], []], typeSchema, 'tags')
      ).toEqual({
        array_data: {
          element_type: DataType.VarChar,
          data: [
            { string_data: { data: ['a', 'b'] }, valid_data: [] },
            { string_data: { data: [] }, valid_data: [] },
          ],
        },
        valid_data: [],
      });
      expect(encodeTypedArrayNode([], typeSchema, 'tags')).toEqual({
        array_data: { element_type: DataType.VarChar, data: [] },
        valid_data: [],
      });
    });

    it('compacts nulls with valid_data at nullable levels', () => {
      expect(
        encodeTypedArrayNode(
          [[1, null, 3], null],
          describedTypeSchema('Int64', { inner: true, leaf: true }),
          'nums'
        )
      ).toEqual({
        array_data: {
          element_type: DataType.Int64,
          data: [
            { long_data: { data: [1, 3] }, valid_data: [true, false, true] },
          ],
        },
        valid_data: [true, false],
      });
    });

    it('uses string_data for Timestamptz leaves', () => {
      expect(
        encodeTypedArrayNode(
          [['2026-01-01T00:00:00Z']],
          describedTypeSchema('Timestamptz'),
          'ts'
        ).array_data.data[0]
      ).toEqual({
        string_data: { data: ['2026-01-01T00:00:00Z'] },
        valid_data: [],
      });
    });

    it('rejects nulls at non-nullable levels and non-array values', () => {
      const typeSchema = describedTypeSchema('VarChar');
      expect(() =>
        encodeTypedArrayNode([['a', null]], typeSchema, 'tags')
      ).toThrow('Array field tags does not allow null elements');
      expect(() => encodeTypedArrayNode([null], typeSchema, 'tags')).toThrow(
        'Array field tags does not allow null elements'
      );
      expect(() => encodeTypedArrayNode(['a'], typeSchema, 'tags')).toThrow(
        'Array field tags expects an array'
      );
      expect(() =>
        encodeTypedArrayNode([], { type_params: [], nullable: false }, 'tags')
      ).toThrow('Array field tags has no element type');
    });

    it('encodes deeper nesting with Array element types', () => {
      const deep: TypeSchema = {
        type_params: [],
        nullable: false,
        array_element: {
          type_params: [],
          nullable: false,
          array_element: describedTypeSchema('Int8'),
        },
      };
      const node = (element_type: DataType, data: any[]) => ({
        array_data: { element_type, data },
        valid_data: [],
      });
      expect(encodeTypedArrayNode([[[[1]]]], deep, 'deep')).toEqual(
        node(DataType.Array, [
          node(DataType.Array, [
            node(DataType.Int8, [{ int_data: { data: [1] }, valid_data: [] }]),
          ]),
        ])
      );
    });

    it('collects each struct element array without recursing', () => {
      const tags: _Field = {
        name: 'tags',
        type: DataType.Array,
        elementType: DataType.Array,
        data: [],
        fieldMap: new Map(),
        typeSchema: describedTypeSchema('VarChar'),
      };
      const posts: _Field = {
        name: 'posts',
        type: DataType.Array,
        elementType: DataType.Struct,
        data: [],
        fieldMap: new Map([['tags', tags]]),
      };
      buildFieldData(
        { posts: [{ tags: ['a'] }, { tags: [] }] },
        posts,
        undefined,
        0
      );
      buildFieldData({ posts: [] }, posts, undefined, 1);
      expect(tags.data).toEqual([[['a'], []], []]);
    });
  });

  describe('read', () => {
    it('decodes nested array_data recursively', () => {
      expect(
        decodeArrayScalarField({
          data: 'array_data',
          array_data: {
            element_type: 'VarChar',
            data: [
              { data: 'string_data', string_data: { data: ['a', 'b'] } },
              { data: 'string_data', string_data: { data: [] } },
            ],
          },
        })
      ).toEqual([['a', 'b'], []]);
      expect(
        decodeArrayScalarField({ data: 'array_data', array_data: {} })
      ).toEqual([]);
      expect(decodeArrayScalarField({})).toEqual([]);
    });

    it('expands valid_data in compact and row-dense payloads', () => {
      expect(
        decodeArrayScalarField({
          data: 'array_data',
          valid_data: [true, false],
          array_data: {
            data: [
              {
                data: 'long_data',
                long_data: { data: ['1', '3'] },
                valid_data: [true, false, true],
              },
            ],
          },
        })
      ).toEqual([['1', null, '3'], null]);
      expect(
        decodeArrayScalarField({
          data: 'int_data',
          int_data: { data: [1, 0] },
          valid_data: [true, false],
        })
      ).toEqual([1, null]);
    });

    it('returns plain arrays for Array sub-fields in struct rows', () => {
      const result = processStructArraysData({
        struct_arrays: {
          fields: [
            {
              field_name: 'post_id',
              scalars: {
                data: 'array_data',
                array_data: {
                  data: [
                    {
                      data: 'string_data',
                      string_data: { data: ['p1', 'p2'] },
                    },
                    { data: 'string_data', string_data: { data: [] } },
                  ],
                },
              },
            },
            {
              field_name: 'tags',
              scalars: {
                data: 'array_data',
                array_data: {
                  element_type: 'Array',
                  data: [
                    {
                      data: 'array_data',
                      array_data: {
                        element_type: 'VarChar',
                        data: [
                          { data: 'string_data', string_data: { data: ['a'] } },
                          { data: 'string_data', string_data: { data: [] } },
                        ],
                      },
                    },
                    {
                      data: 'array_data',
                      array_data: { element_type: 'VarChar', data: [] },
                    },
                  ],
                },
              },
            },
          ],
        },
      });
      expect(result).toEqual([
        [
          { post_id: 'p1', tags: ['a'] },
          { post_id: 'p2', tags: [] },
        ],
        [],
      ]);
    });
  });
});
