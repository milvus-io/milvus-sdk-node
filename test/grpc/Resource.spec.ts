import { MilvusClient, ErrorCode } from '../../milvus';
import {
  IP,
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP });

const DEFAULT_RESOURCE_GROUP = '__default_resource_group';
const COLLECTION_NAME = GENERATE_NAME('col');
const resource_group = GENERATE_NAME('rg');
const resource_group2 = GENERATE_NAME('rg');
const resource_group3 = GENERATE_NAME('rg');
const dbParam = {
  db_name: 'Resource',
};
let runRgTransferTest = false;

describe(`Resource API`, () => {
  let queryNodeNum = 0;
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);

    const metrics = await milvusClient.getMetric({
      request: {
        metric_type: 'system_info',
      },
    });

    const queryNodes = metrics.response.nodes_info.filter(
      (node: any) => node.infos.type === 'querynode'
    );

    queryNodeNum = queryNodes.length;

    runRgTransferTest = queryNodes.length > 1;

    // create collection
    await milvusClient.createCollection(
      genCollectionParams({ collectionName: COLLECTION_NAME, dim: [128] })
    );

    await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create resource group should be successful`, async () => {
    const res = await milvusClient.createResourceGroup({
      resource_group,
    });

    const res2 = await milvusClient.createResourceGroup({
      resource_group: resource_group2,
      // config: {
      //   requests: { node_num: 1 },
      //   limits: { node_num: 10 },
      //   transfer_from: [{ resource_group: DEFAULT_RESOURCE_GROUP }],
      //   transfer_to: [{ resource_group: DEFAULT_RESOURCE_GROUP }],
      // },
    });

    const res3 = await milvusClient.createResourceGroup({
      resource_group: resource_group3,
    });

    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res2.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res3.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`List resource groups should be successful`, async () => {
    const res = await milvusClient.listResourceGroups();

    expect(res.resource_groups).toContain(resource_group);
    expect(res.resource_groups).toContain(resource_group2);
    expect(res.resource_groups).toContain(DEFAULT_RESOURCE_GROUP);
  });

  it(`Describe rg should be successful`, async () => {
    const res = await milvusClient.describeResourceGroup({
      resource_group: DEFAULT_RESOURCE_GROUP,
    });

    // console.dir(res, { depth: null });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.resource_group).toHaveProperty('name');
    expect(res.resource_group).toHaveProperty('num_available_node');
    expect(res.resource_group).toHaveProperty('capacity');

    expect(typeof res.resource_group.name).toBe('string');
    expect(res.resource_group.name).toBe(DEFAULT_RESOURCE_GROUP);
    expect(typeof res.resource_group.num_available_node).toBe('number');
    expect(res.resource_group.num_available_node).toBe(queryNodeNum);
    expect(typeof res.resource_group.capacity).toBe('number');

    await milvusClient.describeResourceGroup({
      resource_group: resource_group2,
    });
  });

  it(`Update rg should be successful`, async () => {
    if (runRgTransferTest) {
      const res = await milvusClient.updateResourceGroups({
        resource_groups: {
          [resource_group]: {
            requests: { node_num: 1 },
            limits: { node_num: 2 },
            transfer_from: [{ resource_group: DEFAULT_RESOURCE_GROUP }],
            transfer_to: [{ resource_group: DEFAULT_RESOURCE_GROUP }],
          },
        },
      });

      expect(res.error_code).toEqual(ErrorCode.SUCCESS);
    }
  });

  it(`Transfer node to another rg should be successful`, async () => {
    if (runRgTransferTest) {
      const res = await milvusClient.transferNode({
        source_resource_group: DEFAULT_RESOURCE_GROUP,
        target_resource_group: resource_group,
        num_node: 1,
      });

      expect(res.error_code).toEqual(ErrorCode.SUCCESS);
    }
  });

  it(`Transfer replica to another rg should be successful`, async () => {
    if (runRgTransferTest) {
      // load col with replica
      await milvusClient.loadCollectionSync({
        collection_name: COLLECTION_NAME,
        replica_number: 2,
        resource_groups: [DEFAULT_RESOURCE_GROUP],
      });

      const res = await milvusClient.transferReplica({
        source_resource_group: DEFAULT_RESOURCE_GROUP,
        target_resource_group: resource_group,
        collection_name: COLLECTION_NAME,
        num_replica: 1,
      });

      expect(res.error_code).toEqual(ErrorCode.SUCCESS);

      // release collection
      await milvusClient.releaseCollection({
        collection_name: COLLECTION_NAME,
      });
    }
  });

  it(`Drop a resource group should be successful`, async () => {
    // drop rg
    const res = await milvusClient.dropResourceGroup({
      resource_group: resource_group3,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Drop all resource groups should be successful`, async () => {
    const res = await milvusClient.dropAllResourceGroups();

    res.forEach(r => {
      expect(r.error_code).toEqual(ErrorCode.SUCCESS);
    });
  });
});
