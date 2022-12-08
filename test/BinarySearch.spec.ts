import { MilvusClient } from '../milvus';

import { GENERATE_NAME, IP } from '../const';
import { DataType } from '../milvus/types/Common';
import { ErrorCode } from '../milvus/types/Response';
import { InsertReq } from '../milvus/types/Data';
import { generateInsertData } from '../utils';
import { genCollectionParams, VECTOR_FIELD_NAME } from '../utils/test';

let milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();

describe('Vector search on binary field', () => {
  beforeAll(async () => {
    await milvusClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME, '128', DataType.BinaryVector, false)
    );
    // create index before load
    await milvusClient.indexManager.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'BIN_IVF_FLAT',
        metric_type: 'TANIMOTO',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    await milvusClient.collectionManager.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
    const fields = [
      {
        isVector: true,
        dim: 16, // 128 / 8
        name: VECTOR_FIELD_NAME,
      },
      {
        isVector: false,
        name: 'age',
      },
    ];
    const vectorsData = generateInsertData(fields, 10);
    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      fields_data: vectorsData,
    };
    await milvusClient.dataManager.insert(params);
    await milvusClient.dataManager.flushSync({
      collection_names: [COLLECTION_NAME],
    });
  });

  afterAll(async () => {
    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it('Expr Vector Search on ', async () => {
    const res = await milvusClient.dataManager.search({
      collection_name: COLLECTION_NAME,
      expr: '',
      vectors: [[4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3]],

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
