import { MilvusClient, ErrorCode } from '../milvus';
import { IP, genCollectionParams, GENERATE_NAME } from './tools';

const milvusClient = new MilvusClient({ address: IP });
const COLLECTION_NAME = GENERATE_NAME();

describe(`Basic API without database`, () => {
  it(`Basic Collection operation Successful`, async () => {
    // create collection
    const res = await milvusClient.createCollection({
      ...genCollectionParams({ collectionName: COLLECTION_NAME, dim: 128 }),
      consistency_level: 'Eventually',
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);

    // make sure load successful
    const index = await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'vector',
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    expect(index.error_code).toEqual(ErrorCode.SUCCESS);

    // load collection
    const load = await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
    expect(load.error_code).toEqual(ErrorCode.SUCCESS);

    // show collections
    const show = await milvusClient.showCollections();
    expect(show.status.error_code).toEqual(ErrorCode.SUCCESS);

    // releases
    const release = await milvusClient.releaseCollection({
      collection_name: COLLECTION_NAME,
      timeout: 15000,
    });
    expect(release.error_code).toEqual(ErrorCode.SUCCESS);

    // releases
    const drop = await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(drop.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
