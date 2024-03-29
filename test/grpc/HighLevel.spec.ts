import {
  MilvusClient,
  ErrorCode,
  DataType,
  CreateIndexSimpleReq,
  IndexType,
  MetricType,
  LoadState,
  findKeyValue,
  DEFAULT_METRIC_TYPE,
} from '../../milvus';
import { IP, GENERATE_NAME } from '../tools';

const milvusClient = new MilvusClient({
  address: IP,
});
const FAST_CREATE_COL_NAME = GENERATE_NAME();
const CREATE_COL_SCHEMA_INDEX_NAME = GENERATE_NAME();
const CREATE_COL_SCHEMA_NAME = GENERATE_NAME();
const CREATE_COL_SCHEMA_INDEX_NAME_SINGLE = GENERATE_NAME();

const schema = [
  {
    name: 'vector',
    description: 'Vector field',
    data_type: DataType.FloatVector,
    dim: 4,
  },
  {
    name: 'id',
    description: 'ID field',
    data_type: DataType.Int64,
    is_primary_key: true,
    autoID: true,
  },
  {
    name: 'int16',
    description: 'int16 field',
    data_type: DataType.Int16,
    is_partition_key: false,
  },
  {
    name: 'varChar',
    description: 'VarChar field',
    data_type: DataType.VarChar,
    max_length: 128,
    is_partition_key: false,
  },
];

const index_params: Omit<CreateIndexSimpleReq, 'collection_name'>[] = [
  {
    field_name: 'vector',
    index_type: IndexType.HNSW,
    metric_type: MetricType.COSINE,
    params: {
      M: 5,
      efConstruction: 8,
    },
  },
  {
    field_name: 'int16',
    index_type: IndexType.STL_SORT,
  },
  {
    field_name: 'varChar',
    index_type: IndexType.TRIE,
  },
];

describe(`High level API testing`, () => {
  afterAll(async () => {
    for (let collection_name of [
      FAST_CREATE_COL_NAME,
      CREATE_COL_SCHEMA_INDEX_NAME,
      CREATE_COL_SCHEMA_NAME,
      CREATE_COL_SCHEMA_INDEX_NAME_SINGLE,
    ]) {
      await milvusClient.dropCollection({ collection_name: collection_name });
    }
  });
  it(`Fast collection should be successful`, async () => {
    const dim = 4;
    const create = await milvusClient.createCollection({
      collection_name: FAST_CREATE_COL_NAME,
      dimension: dim,
      consistency_level: 'Strong',
    });

    const des = await milvusClient.describeCollection({
      collection_name: FAST_CREATE_COL_NAME,
    });
    expect(des.consistency_level).toEqual('Strong');
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const vectorField = des.schema.fields.find(
      v =>
        v.dataType === DataType.BinaryVector ||
        v.dataType === DataType.FloatVector
    );
    expect(
      Number(vectorField?.type_params.find(item => item.key === 'dim')?.value)
    ).toEqual(dim);

    const index = await milvusClient.describeIndex({
      collection_name: FAST_CREATE_COL_NAME,
    });

    expect(
      findKeyValue(index.index_descriptions[0].params, 'metric_type')
    ).toEqual(DEFAULT_METRIC_TYPE);
  });

  it(`Create collection with schema should be successful`, async () => {
    const create = await milvusClient.createCollection({
      collection_name: CREATE_COL_SCHEMA_NAME,
      schema: schema,
    });
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const des = await milvusClient.describeCollection({
      collection_name: CREATE_COL_SCHEMA_NAME,
    });

    // test dim is correct
    const vectorField = des.schema.fields.find(
      v =>
        v.dataType === DataType.BinaryVector ||
        v.dataType === DataType.FloatVector
    );
    expect(
      Number(vectorField?.type_params.find(item => item.key === 'dim')?.value)
    ).toEqual(schema[0].dim);
  });

  it(`Create collection with schema and index_params should be successful`, async () => {
    const create = await milvusClient.createCollection({
      collection_name: CREATE_COL_SCHEMA_INDEX_NAME,
      schema: schema,
      index_params: index_params,
    });

    const des = await milvusClient.describeCollection({
      collection_name: CREATE_COL_SCHEMA_INDEX_NAME,
    });
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    // test dim is correct
    const vectorField = des.schema.fields.find(
      v =>
        v.dataType === DataType.BinaryVector ||
        v.dataType === DataType.FloatVector
    );
    expect(
      Number(vectorField?.type_params.find(item => item.key === 'dim')?.value)
    ).toEqual(schema[0].dim);

    // test index
    const indexes = await milvusClient.describeIndex({
      collection_name: CREATE_COL_SCHEMA_INDEX_NAME,
    });
    expect(indexes.index_descriptions.length).toEqual(index_params.length);

    // test collection load state
    const load = await milvusClient.getLoadState({
      collection_name: CREATE_COL_SCHEMA_INDEX_NAME,
    });
    expect(load.state).toEqual(LoadState.LoadStateLoaded);
  });

  it(`Create collection with schema and single index_params should be successful`, async () => {
    const create = await milvusClient.createCollection({
      collection_name: CREATE_COL_SCHEMA_INDEX_NAME_SINGLE,
      schema: schema,
      index_params: index_params[0],
    });

    const des = await milvusClient.describeCollection({
      collection_name: CREATE_COL_SCHEMA_INDEX_NAME_SINGLE,
    });
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    // test dim is correct
    const vectorField = des.schema.fields.find(
      v =>
        v.dataType === DataType.BinaryVector ||
        v.dataType === DataType.FloatVector
    );
    expect(
      Number(vectorField?.type_params.find(item => item.key === 'dim')?.value)
    ).toEqual(schema[0].dim);

    // test index
    const indexes = await milvusClient.describeIndex({
      collection_name: CREATE_COL_SCHEMA_INDEX_NAME_SINGLE,
    });
    expect(indexes.index_descriptions.length).toEqual(1);

    // test collection load state
    const load = await milvusClient.getLoadState({
      collection_name: CREATE_COL_SCHEMA_INDEX_NAME_SINGLE,
    });
    expect(load.state).toEqual(LoadState.LoadStateLoaded);
  });

  it('create collection failed should throw error', async () => {
    try {
      await milvusClient.createCollection({
        collection_name: 'fail_collection1',
        schema: [
          {
            name: 'vector',
            description: 'Vector field',
            data_type: DataType.FloatVector,
            dim: 400000000,
          },
          {
            name: 'id',
            description: 'ID field',
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: true,
          },
          {
            name: 'int16',
            description: 'int16 field',
            data_type: DataType.Int16,
            is_partition_key: false,
          },
          {
            name: 'varChar',
            description: 'VarChar field',
            data_type: DataType.VarChar,
            max_length: 128,
            is_partition_key: false,
          },
        ],
        index_params: index_params[0],
      });
    } catch (error) {
      expect(error.message.includes('invalid dimension')).toEqual(true);
    }

    try {
      await milvusClient.createCollection({
        collection_name: 'fail_collection2',
        schema: schema,
        index_params: {
          field_name: 'vector2322',
          index_type: IndexType.HNSW,
          metric_type: MetricType.COSINE,
          params: {
            M: 5,
            efConstruction: 8,
          },
        },
      });
    } catch (error) {
      expect(error.message.includes('non-exist')).toEqual(true);
    }
  });
});
