import { MilvusClient, ErrorCode, IndexType, MetricType } from '../../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
const COLLECTION_NAME = GENERATE_NAME();

const dbParam = {
  db_name: 'Geometry',
};

const p = {
  collectionName: COLLECTION_NAME,
  dim: [128],
};
const collectionParams = genCollectionParams(p);
const data = generateInsertData(collectionParams.fields, 2);

// console.log('data to insert', data);

describe(`Geometry API testing`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create collection with geometry vectors should be successful`, async () => {
    const create = await milvusClient.createCollection(collectionParams);
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });

    // console.dir(describe, { depth: null });

    const geometryFields = describe.schema.fields.filter(
      (field: any) => field.data_type === 'Geometry'
    );
    expect(geometryFields.length).toBe(1);

    // console.dir(describe.schema, { depth: null });
  });

  it(`insert geometry should be successful`, async () => {
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data,
    });

    // console.log(' insert', insert);

    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(insert.succ_index.length).toEqual(data.length);
  });

  it(`create index should be successful`, async () => {
    const indexes = await milvusClient.createIndex([
      {
        collection_name: COLLECTION_NAME,
        field_name: 'vector',
        metric_type: MetricType.L2,
        index_type: IndexType.AUTOINDEX,
      },
      {
        collection_name: COLLECTION_NAME,
        field_name: 'geometry',
        index_type: IndexType.RTREE,
      },
    ]);

    expect(indexes.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`load collection should be successful`, async () => {
    const load = await milvusClient.loadCollection({
      collection_name: COLLECTION_NAME,
    });

    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`query geometry should be successful`, async () => {
    const count = await milvusClient.count({
      collection_name: COLLECTION_NAME,
    });

    expect(count.data).toEqual(data.length);

    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'id > 0',
      output_fields: ['id', 'geometry'],
    });

    // verify the query result - parse coordinates and compare with tolerance
    const parseGeometry = (geomStr: string) => {
      const match = geomStr.match(/POINT \(([\d.-]+) ([\d.-]+)\)/);
      if (match) {
        return {
          x: parseFloat(match[1]),
          y: parseFloat(match[2])
        };
      }
      return null;
    };

    const expected0 = parseGeometry(data[0].geometry);
    const received0 = parseGeometry(query.data[0].geometry);
    const expected1 = parseGeometry(data[1].geometry);
    const received1 = parseGeometry(query.data[1].geometry);

    expect(expected0).not.toBeNull();
    expect(received0).not.toBeNull();
    expect(expected1).not.toBeNull();
    expect(received1).not.toBeNull();

    // Compare with tolerance for floating point precision (5 decimal places)
    expect(received0!.x).toBeCloseTo(expected0!.x, 5);
    expect(received0!.y).toBeCloseTo(expected0!.y, 5);
    expect(received1!.x).toBeCloseTo(expected1!.x, 5);
    expect(received1!.y).toBeCloseTo(expected1!.y, 5);

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`search output fields with geometry should be successful`, async () => {
    const search = await milvusClient.search({
      data: data[0].vector,
      collection_name: COLLECTION_NAME,
      output_fields: ['id', 'vector'],
      limit: 5,
    });

    // console.log('search', search);

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);
  });

  it(`search with geometry vector and nq > 0 should be successful`, async () => {
    const search = await milvusClient.search({
      data: [data[0].vector, data[1].vector],
      collection_name: COLLECTION_NAME,
      output_fields: ['id', 'vector'],
      limit: 5,
    });

    // console.log('search', search);
    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);
  });
});