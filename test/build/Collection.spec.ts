/** This file only test build files. */
import {
  MilvusClient,
  DataType,
  ErrorCode,
  ShowCollectionsType,
  ERROR_REASONS,
} from '../../dist/milvus';
import {
  IP,
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP });
const COLLECTION_NAME = GENERATE_NAME();
const LOAD_COLLECTION_NAME = GENERATE_NAME();
const COLLECTION_NAME_PARAMS = genCollectionParams({
  collectionName: COLLECTION_NAME,
  dim: [128],
});

describe('Collection Api', () => {
  it(`Create Collection Successful`, async () => {
    const res = await milvusClient.createCollection(COLLECTION_NAME_PARAMS);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create Collection validate fields`, async () => {
    try {
      await milvusClient.createCollection({
        collection_name: 'zxc',
        fields: [
          {
            name: 'vector_01',
            description: 'vector field',
            data_type: DataType.FloatVector,
            dim: 128,
          },
        ],
      });
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_PRIMARY_KEY
      );
    }

    try {
      await milvusClient.createCollection({
        collection_name: 'zxc',
        fields: [
          {
            name: 'id',
            description: '',
            data_type: DataType.Int64,
            is_primary_key: true,
          },
        ],
      });
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_VECTOR_FIELD_EXIST
      );
    }
  });

  it(`Create Collection expect dim error`, async () => {
    try {
      await milvusClient.createCollection({
        collection_name: 'zxc',
        fields: [
          {
            name: 'vector_01',
            description: 'vector field',
            data_type: 'FloatVector',
          },
          {
            name: 'id',
            description: '',
            data_type: DataType.Int64,
            is_primary_key: true,
          },
        ],
      });
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_MISS_DIM
      );
    }

    try {
      await milvusClient.createCollection(
        genCollectionParams({
          collectionName: 'any',
          vectorType: [DataType.BinaryVector],
          dim: [6],
        })
      );
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_BINARY_DIM
      );
    }
  });

  it(`Create load Collection Successful`, async () => {
    const res = await milvusClient.createCollection(
      genCollectionParams({ collectionName: LOAD_COLLECTION_NAME, dim: [128] })
    );
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Has collection `, async () => {
    const res = await milvusClient.hasCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.value).toEqual(true);
  });

  it(`Has collection not exist`, async () => {
    const res = await milvusClient.hasCollection({
      collection_name: 'collection_not_exist',
    });
    expect(res.value).toEqual(false);
  });

  it(`Show all collections`, async () => {
    const res = await milvusClient.showCollections();
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.data.filter(v => v.name === COLLECTION_NAME).length).toEqual(1);
  });

  it(`Get Collection Statistics`, async () => {
    const res = await milvusClient.getCollectionStatistics({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.stats[0].value).toEqual('0');
    expect(res.data.row_count).toEqual('0');
  });

  it('Describe Collection info', async () => {
    const res = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.schema.name).toEqual(COLLECTION_NAME);
    expect(res.schema.fields.length).toEqual(
      COLLECTION_NAME_PARAMS.fields.length
    );
    expect(res.schema.fields[0].name).toEqual(VECTOR_FIELD_NAME);
    expect(res.schema.fields[1].name).toEqual('id');
  });

  it(`Load Collection`, async () => {
    await milvusClient.createIndex({
      collection_name: LOAD_COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      index_type: 'IVF_FLAT',
      metric_type: 'L2',
      params: { nlist: 1024 },
    });
    const res = await milvusClient.loadCollectionSync({
      collection_name: LOAD_COLLECTION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Show loaded collections expect contain one`, async () => {
    const res = await milvusClient.showCollections({
      type: ShowCollectionsType.Loaded,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);

    expect(
      res.data.filter(v => v.name === LOAD_COLLECTION_NAME).length
    ).toEqual(1);
  });

  it(`Release Collection`, async () => {
    const res = await milvusClient.releaseCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Drop Collection`, async () => {
    const res = await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.dropCollection({
      collection_name: LOAD_COLLECTION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
