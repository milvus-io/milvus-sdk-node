import { MilvusClient } from '../milvus';
import { GENERATE_NAME, IP } from '../const';
import { ErrorCode } from '../milvus/types/Response';
import {
  genCollectionParams,
  VECTOR_FIELD_NAME,
  INDEX_NAME,
} from '../utils/test';
import { timeoutTest } from './common/timeout';

let milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

describe('Collection Api', () => {
  beforeAll(async () => {
    await milvusClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME, '8')
    );
  });

  afterAll(async () => {
    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`Create Index with name should success`, async () => {
    const res = await milvusClient.indexManager.createIndex({
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

  // it(`Create Index not exist type`, async () => {
  //   const res = await milvusClient.createIndex({
  //     collection_name: COLLECTION_NAME,
  //     field_name: "vector_02",
  //     extra_params: [
  //       {
  //         key: "index_type",
  //         value: "NOT exist",
  //       },
  //       {
  //         key: "params",
  //         value: JSON.stringify({ nlist: 1024 }),
  //       },
  //     ],
  //   });
  //   console.log(res);
  //   expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  // });

  it(`Describe Index`, async () => {
    const res = await milvusClient.indexManager.describeIndex({
      collection_name: COLLECTION_NAME,
    });
    // console.log('----describeIndex ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(
    'Test Describe Index should timeout',
    timeoutTest(
      milvusClient.indexManager.describeIndex.bind(milvusClient.indexManager),
      { collection_name: COLLECTION_NAME }
    )
  );

  it(`Get Index State`, async () => {
    const res = await milvusClient.indexManager.getIndexState({
      collection_name: COLLECTION_NAME,
    });
    // console.log('----getIndexState ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Get Index progress`, async () => {
    const res = await milvusClient.indexManager.getIndexBuildProgress({
      index_name: INDEX_NAME,
      collection_name: COLLECTION_NAME,
    });
    // console.log('----getIndexBuildProgress ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Drop Index `, async () => {
    const res = await milvusClient.indexManager.dropIndex({
      index_name: INDEX_NAME,
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
    });
    // console.log('----drop index ----', res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Describe Index should be not exist`, async () => {
    const res = await milvusClient.indexManager.describeIndex({
      index_name: INDEX_NAME,
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
    });
    // console.log('----describe index after drop ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.INDEX_NOT_EXIST);
  });
});
