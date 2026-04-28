import {
  MilvusClient,
  DataType,
  ErrorCode,
  IndexType,
  MetricType,
} from '../../milvus';
import { GENERATE_NAME, IP } from '../tools';

const milvusClient = new MilvusClient({
  address: IP,
  logLevel: 'info',
});
const COLLECTION_NAME = GENERATE_NAME('element_level');
const dbParam = { db_name: 'element_level_DB' };

const vectors = {
  first: [1, 0, 0, 0],
  second: [0, 1, 0, 0],
  third: [0, 0, 1, 0],
  fourth: [0, 0, 0, 1],
  fifth: [-1, 0, 0, 0],
};

describe('Element-level query/search', () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
    await milvusClient.createCollection({
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
          name: 'items',
          data_type: DataType.Array,
          element_type: DataType.Struct,
          max_capacity: 3,
          fields: [
            {
              name: 'label',
              data_type: DataType.VarChar,
              max_length: 16,
            },
            {
              name: 'order',
              data_type: DataType.Int32,
            },
            {
              name: 'embedding',
              data_type: DataType.FloatVector,
              dim: 4,
            },
          ],
        },
      ],
    });
    await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data: [
        {
          id: 1,
          items: [
            { label: 'first', order: 10, embedding: vectors.first },
            { label: 'second', order: 20, embedding: vectors.second },
            { label: 'third', order: 30, embedding: vectors.third },
          ],
        },
        {
          id: 2,
          items: [
            { label: 'fourth', order: 40, embedding: vectors.fourth },
            { label: 'fifth', order: 50, embedding: vectors.fifth },
          ],
        },
      ],
    });
    await milvusClient.flush({ collection_names: [COLLECTION_NAME] });
    const index = await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'items[embedding]',
      index_name: 'items_embedding_cosine',
      metric_type: MetricType.COSINE,
      index_type: IndexType.AUTOINDEX,
    });
    expect(index.error_code).toEqual(ErrorCode.SUCCESS);
    const load = await milvusClient.loadCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    await milvusClient.dropDatabase(dbParam);
  });

  it('should return offsets for element-level query rows', async () => {
    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'element_filter(items, $[order] == 20)',
      output_fields: ['id', 'items[label]', 'items[order]'],
    });

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(query.data).toHaveLength(1);
    expect(query.data[0]).toMatchObject({
      id: '1',
      offset: '1',
    });
    const matchedElement = query.data[0].items[Number(query.data[0].offset)];
    expect(matchedElement.label).toEqual('second');
    expect(matchedElement.order).toEqual(20);
  });

  it('should return offsets for element-level search hits', async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      data: vectors.second,
      anns_field: 'items[embedding]',
      output_fields: ['id', 'items[label]', 'items[order]'],
      limit: 3,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results[0]).toMatchObject({
      id: '1',
      offset: '1',
    });
    const matchedElement =
      search.results[0].items[Number(search.results[0].offset)];
    expect(matchedElement.label).toEqual('second');
    expect(matchedElement.order).toEqual(20);
  });
});
