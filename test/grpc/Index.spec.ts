import {
  MilvusClient,
  ErrorCode,
  MetricType,
  IndexType,
  findKeyValue,
} from '../../milvus';
import {
  IP,
  genCollectionParams,
  VECTOR_FIELD_NAME,
  INDEX_NAME,
  GENERATE_NAME,
} from '../tools';
import { timeoutTest } from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
// names
const COLLECTION_NAME = GENERATE_NAME();
const COLLECTION_NAME_WITHOUT_INDEX_NAME = GENERATE_NAME();
const dbParam = {
  db_name: 'MilvusIndex',
};

const INDEX_COLLECTIONS = Array(8).fill(1);
for (let i = 0; i < INDEX_COLLECTIONS.length; i++) {
  INDEX_COLLECTIONS[i] = GENERATE_NAME();
}

const [
  COL_FLAT,
  COL_IVF_FLAT,
  COL_IVF_SQ8,
  COL_IVF_PQ,
  COL_HNSW,
  COL_SIMPLE,
  DISKANN,
  ScaNN,
] = INDEX_COLLECTIONS;

describe(`Milvus Index API`, () => {
  beforeAll(async () => {
    // create db and use db
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
    await milvusClient.createCollection(
      genCollectionParams({ collectionName: COLLECTION_NAME, dim: [8] })
    );
    await milvusClient.createCollection(
      genCollectionParams({
        collectionName: COLLECTION_NAME_WITHOUT_INDEX_NAME,
        dim: [8],
      })
    );

    for (let i = 0; i < INDEX_COLLECTIONS.length; i++) {
      await milvusClient.createCollection(
        genCollectionParams({ collectionName: INDEX_COLLECTIONS[i], dim: [32] })
      );
    }
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME_WITHOUT_INDEX_NAME,
    });

    for (let i = 0; i < INDEX_COLLECTIONS.length; i++) {
      await milvusClient.dropCollection({
        collection_name: INDEX_COLLECTIONS[i],
      });
    }
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create SIMPLE index should success`, async () => {
    const res = await milvusClient.createIndex({
      collection_name: COL_SIMPLE,
      field_name: VECTOR_FIELD_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create FLAT index should success`, async () => {
    const res = await milvusClient.createIndex({
      collection_name: COL_FLAT,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
      index_type: 'FLAT',
      metric_type: MetricType.COSINE,
      params: { nlist: 1024 },
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);

    const creates = await milvusClient.createIndex([
      {
        collection_name: COL_FLAT,
        field_name: VECTOR_FIELD_NAME,
        index_type: 'FLAT',
        metric_type: MetricType.COSINE,
        params: { nlist: 1024 },
      },
      {
        collection_name: COL_FLAT,
        field_name: 'int64',
        index_type: IndexType.STL_SORT,
        params: { nlist: 1024 },
      },
    ]);

    expect(creates.error_code).toEqual(ErrorCode.SUCCESS);

    const createsError = await milvusClient.createIndex([
      {
        collection_name: COL_FLAT,
        field_name: VECTOR_FIELD_NAME,
        index_type: 'FLAT',
        metric_type: MetricType.COSINE,
        params: { nlist: 1024 },
      },
      {
        collection_name: COL_FLAT,
        field_name: 'int642',
        index_type: IndexType.STL_SORT,
        params: { nlist: 1024 },
      },
    ]);

    expect(createsError.error_code).toEqual(ErrorCode.UnexpectedError);
  });

  it(`Create IVF_FLAT index should success`, async () => {
    const res = await milvusClient.createIndex({
      collection_name: COL_IVF_FLAT,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create IVF_SQ8 index should success`, async () => {
    const res = await milvusClient.createIndex({
      collection_name: COL_IVF_SQ8,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_SQ8',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create IVF_PQ index should success`, async () => {
    const res = await milvusClient.createIndex({
      collection_name: COL_IVF_PQ,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_PQ',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024, m: 8, nbits: 8 }),
      },
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create HNSW index should success`, async () => {
    const res = await milvusClient.createIndex({
      collection_name: COL_HNSW,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'HNSW',
        metric_type: 'L2',
        params: JSON.stringify({ M: 4, efConstruction: 8 }),
      },
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);

    const res2 = await milvusClient.createIndex({
      collection_name: COL_HNSW,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
      index_type: 'HNSW',
      metric_type: 'L2',
      params: {
        M: 4,
        efConstruction: 8,
      },
    });

    expect(res2.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create DISKANN index should success`, async () => {
    const res = await milvusClient.createIndex({
      collection_name: DISKANN,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: IndexType.DISKANN,
        metric_type: 'L2',
      },
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create ScaNN index should success`, async () => {
    const res = await milvusClient.createIndex({
      collection_name: ScaNN,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
      index_type: IndexType.ScaNN,
      metric_type: 'L2',
      params: { nlist: 1024 },
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create Index with name should success`, async () => {
    const res = await milvusClient.createIndex({
      index_name: INDEX_NAME,
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create STL_SORT index on int64 should success`, async () => {
    const res = await milvusClient.createIndex({
      index_name: 'int64_index',
      collection_name: COLLECTION_NAME,
      field_name: 'int64',
      index_type: IndexType.STL_SORT,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create TRIE index on int64 varchar success`, async () => {
    const res = await milvusClient.createIndex({
      index_name: 'varchar_index',
      collection_name: COLLECTION_NAME,
      field_name: 'varChar',
      index_type: IndexType.TRIE,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create INVERTED index on int64 varchar success`, async () => {
    const res = await milvusClient.createIndex({
      index_name: 'float_index',
      collection_name: COLLECTION_NAME,
      field_name: 'float',
      index_type: IndexType.INVERTED,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create Bitmap index on int32_array array should success`, async () => {
    const res = await milvusClient.createIndex({
      index_name: 'bitmap_index',
      collection_name: COLLECTION_NAME,
      field_name: 'int32_array',
      index_type: IndexType.BITMAP,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create Index without name should success`, async () => {
    const res = await milvusClient.createIndex({
      collection_name: COLLECTION_NAME_WITHOUT_INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create Index not exist type should failed`, async () => {
    const res = await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'vector_02',
      extra_params: {
        index_type: 'abcd',
        metric_type: 'HAMMING',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    expect(res.error_code).toEqual(ErrorCode.UnexpectedError);
  });

  it(`Describe Index with index name`, async () => {
    const res = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
    });
    const allIndexNames = res.index_descriptions.map(i => i.index_name);
    expect(allIndexNames.includes(INDEX_NAME)).toEqual(true);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Describe Index with field name`, async () => {
    const res = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
    });

    const field_names = res.index_descriptions.map(i => i.field_name);
    expect(field_names.includes(VECTOR_FIELD_NAME)).toEqual(true);

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Describe Index without index name`, async () => {
    const res = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME_WITHOUT_INDEX_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`list Index should be success`, async () => {
    const res = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME,
    });
    const list = await milvusClient.listIndexes({
      collection_name: COLLECTION_NAME,
    });
    const allIndexNames = res.index_descriptions.map(i => i.index_name);
    expect(list.indexes.length).toEqual(allIndexNames.length);

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(
    'Test Describe Index should timeout',
    timeoutTest(milvusClient.describeIndex.bind(milvusClient), {
      collection_name: COLLECTION_NAME,
    })
  );

  it(`Get Index State with index name`, async () => {
    const res = await milvusClient.getIndexState({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Get Index progress with index name`, async () => {
    const res = await milvusClient.getIndexBuildProgress({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Alter Index should be success`, async () => {
    const alter = await milvusClient.alterIndex({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
      params: {
        'mmap.enabled': true,
      },
    });

    const describe = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
    });
    expect(alter.error_code).toEqual(ErrorCode.SUCCESS);
    const params = describe.index_descriptions[0].params;
    expect(findKeyValue(params, 'mmap.enabled')).toEqual('true');

    const alter2 = await milvusClient.alterIndexProperties({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
      params: {
        'mmap.enabled': false,
      },
    });

    const describe2 = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
    });

    expect(alter2.error_code).toEqual(ErrorCode.SUCCESS);
    const params2 = describe2.index_descriptions[0].params;
    expect(findKeyValue(params2, 'mmap.enabled')).toEqual('false');

    // console.log('describe', describe.index_descriptions[0].params);
  });

  it(`Drop Index properties with field name should be success`, async () => {
    const res = await milvusClient.dropIndexProperties({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
      properties: ['mmap.enabled'],
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
    });

    const params = describe.index_descriptions[0].params;
    expect(findKeyValue(params, 'mmap.enabled')).toEqual(undefined);
  });

  // @Deprecated
  // it(`Get Index progress with field name should be failed`, async () => {
  //   const res = await milvusClient.getIndexBuildProgress({
  //     collection_name: COLLECTION_NAME,
  //     field_name: VECTOR_FIELD_NAME,
  //   });
  //   expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  // });

  it(`Drop Index with index name`, async () => {
    const res = await milvusClient.dropIndex({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Drop Index without index name`, async () => {
    const res = await milvusClient.dropIndex({
      collection_name: COLLECTION_NAME_WITHOUT_INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Describe Index should be not exist`, async () => {
    const res = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.IndexNotExist);

    const res2 = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME_WITHOUT_INDEX_NAME,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.IndexNotExist);
    expect(res2.status.error_code).toEqual(ErrorCode.IndexNotExist);
  });
});
