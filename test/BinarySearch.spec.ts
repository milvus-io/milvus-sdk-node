import { MilvusClient, DataType, ErrorCode, InsertReq } from '../milvus';
import {
  IP,
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
  generateInsertData,
} from './tools';

let milvusClient = new MilvusClient({ address: IP });
const COLLECTION_NAME = GENERATE_NAME();
const dbParam = {
  db_name: 'BinarySearch',
};

describe(`Binary search API`, () => {
  beforeAll(async () => {
    // create db and use db
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);

    const createCollectionParams = genCollectionParams({
      collectionName: COLLECTION_NAME,
      dim: 128,
      vectorType: DataType.BinaryVector,
      autoID: false,
    });
    await milvusClient.createCollection(createCollectionParams);
    // create index before load
    await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'BIN_IVF_FLAT',
        metric_type: 'TANIMOTO',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });

    const vectorsData = generateInsertData(createCollectionParams.fields, 10);
    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      fields_data: vectorsData,
    };
    await milvusClient.insert(params);
    await milvusClient.flushSync({
      collection_names: [COLLECTION_NAME],
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Expr Vector Search on`, async () => {
    const res = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      expr: '',
      vectors: [
        Array.from({ length: 16 }).map(() => (Math.random() > 0.5 ? 1 : 0)),
      ],

      search_params: {
        anns_field: VECTOR_FIELD_NAME,
        topk: '4',
        metric_type: 'TANIMOTO',
        params: JSON.stringify({ nprobe: 1024 }),
        round_decimal: -1,
      },
      vector_type: DataType.BinaryVector,
    });
    // console.log('----- Binary Vector Search  -----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
