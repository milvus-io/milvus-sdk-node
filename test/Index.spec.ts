import { MilvusClient, ErrorCode } from '../milvus';
import { IP } from '../const';
import {
  genCollectionParams,
  VECTOR_FIELD_NAME,
  INDEX_NAME,
  GENERATE_NAME,
} from '../utils/test';
import { timeoutTest } from './common/timeout';

const milvusClient = new MilvusClient({ address: IP, debug: false });
// names
const COLLECTION_NAME = GENERATE_NAME();
const COLLECTION_NAME_WITHOUT_INDEX_NAME = GENERATE_NAME();
const INDEX_COLLECTIONS = Array(7).fill(1);

for (let i = 0; i < INDEX_COLLECTIONS.length; i++) {
  INDEX_COLLECTIONS[i] = GENERATE_NAME();
}

const [
  COL_FLAT,
  COL_IVF_FLAT,
  COL_IVF_SQ8,
  COL_IVF_PQ,
  COL_HNSW,
  COL_ANNOY,
  DISKANN,
] = INDEX_COLLECTIONS;

describe(`Index API`, () => {
  beforeAll(async () => {
    await milvusClient.createCollection(
      genCollectionParams(COLLECTION_NAME, '8')
    );
    await milvusClient.createCollection(
      genCollectionParams(COLLECTION_NAME_WITHOUT_INDEX_NAME, '8')
    );

    for (let i = 0; i < INDEX_COLLECTIONS.length; i++) {
      await milvusClient.createCollection(
        genCollectionParams(INDEX_COLLECTIONS[i], '8')
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
  });

  it(`Create FLAT index should success`, async () => {
    const res = await milvusClient.createIndex({
      collection_name: COL_FLAT,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
      index_type: 'FLAT',
      metric_type: 'L2',
      params: { nlist: 1024 },
    });
    // console.log(res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
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
    // console.log(res);
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
    // console.log(res);
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
    // console.log(res);
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
    // console.log(res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create ANNOY index should success`, async () => {
    const res = await milvusClient.createIndex({
      collection_name: COL_ANNOY,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'ANNOY',
        metric_type: 'L2',
        params: JSON.stringify({ n_trees: 8 }),
      },
    });
    // console.log(res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  // it(`Create DISKANN index should success`, async () => {
  //   const res = await milvusClient.createIndex({
  //     collection_name: DISKANN,
  //     index_name: INDEX_NAME,
  //     field_name: VECTOR_FIELD_NAME,
  //     extra_params: {
  //       index_type: 'DISKANN',
  //       metric_type: 'L2',
  //     },
  //   });
  //   console.log(res);
  //   expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  // });

  it(`Create Index with name should success`, async () => {
    const res = await milvusClient.createIndex({
      index_name: INDEX_NAME,
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'BIN_IVF_FLAT',
        metric_type: 'HAMMING',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    // console.log(res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create Index without name should success`, async () => {
    const res = await milvusClient.createIndex({
      collection_name: COLLECTION_NAME_WITHOUT_INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'BIN_IVF_FLAT',
        metric_type: 'HAMMING',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    // console.log(res);
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
    expect(res.error_code).toEqual(ErrorCode.UNEXPECTED_ERROR);
  });

  it(`Describe Index with index name`, async () => {
    const res = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
    });
    // console.log('----describeIndex ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Describe Index without index name`, async () => {
    const res = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME_WITHOUT_INDEX_NAME,
    });
    // console.log('----describeIndex ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(
    'Test Describe Index should timeout',
    timeoutTest(milvusClient.describeIndex.bind(milvusClient), {
      collection_name: COLLECTION_NAME,
    })
  );

  it(`Get Index with name State`, async () => {
    const res = await milvusClient.getIndexState({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
    });
    // console.log('----getIndexState ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Get Index without name progress`, async () => {
    const res = await milvusClient.getIndexBuildProgress({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
    });
    // console.log('----getIndexBuildProgress with name ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Get Index with name progress`, async () => {
    const res = await milvusClient.getIndexBuildProgress({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
    });
    // console.log('----getIndexBuildProgress with name ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Drop Index with index name`, async () => {
    const res = await milvusClient.dropIndex({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
    });
    // console.log('----drop index ----', res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Drop Index without index name`, async () => {
    const res = await milvusClient.dropIndex({
      collection_name: COLLECTION_NAME_WITHOUT_INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
    });
    // console.log('----drop index ----', res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Describe Index should be not exist`, async () => {
    const res = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
    });
    // console.log('----describe index after drop ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.INDEX_NOT_EXIST);

    const res2 = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME_WITHOUT_INDEX_NAME,
      index_name: INDEX_NAME,
      field_name: VECTOR_FIELD_NAME,
    });
    // console.log('----describe index after drop ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.INDEX_NOT_EXIST);
    expect(res2.status.error_code).toEqual(ErrorCode.INDEX_NOT_EXIST);
  });
});
