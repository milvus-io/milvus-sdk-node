import { MilvusClient } from '../milvus';
import { IP } from '../const';
import { ErrorCode } from '../milvus/types/Response';
import {
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../utils/test';

let milvusClient = new MilvusClient(IP);

const DEFAULT_RESOURCE_GROUP = '__default_resource_group';
const COLLECTION_NAME = GENERATE_NAME('col');
const resource_group = GENERATE_NAME('rg');
const resource_group2 = GENERATE_NAME('rg');
const resource_group3 = GENERATE_NAME('rg');

let runRgTransferTest = false;

describe('Resource Api', () => {
  beforeAll(async () => {
    // [TODO]: move getMetric to client
    const metrics = await milvusClient.dataManager.getMetric({
      request: {
        metric_type: 'system_info',
      },
    });

    const queryNodes = metrics.response.nodes_info.filter(
      (node: any) => node.infos.type === 'querynode'
    );

    runRgTransferTest = queryNodes.length > 1;

    // create collection
    await milvusClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME, '128')
    );

    await milvusClient.indexManager.createIndex({
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
    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  it(`Create resource group should be successful`, async () => {
    const res = await milvusClient.resourceManager.createResourceGroup({
      resource_group,
    });

    const res2 = await milvusClient.resourceManager.createResourceGroup({
      resource_group: resource_group2,
    });

    const res3 = await milvusClient.resourceManager.createResourceGroup({
      resource_group: resource_group3,
    });

    // console.log('create resource group', res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res2.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res3.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`List resource groups should be successful`, async () => {
    const res = await milvusClient.resourceManager.listResourceGroups();

    // console.log('list resource group', res);
    expect(res.resource_groups).toContain(resource_group);
    expect(res.resource_groups).toContain(resource_group2);
    expect(res.resource_groups).toContain(DEFAULT_RESOURCE_GROUP);
  });

  it(`Describe rg should be successful`, async () => {
    const res = await milvusClient.resourceManager.describeResourceGroup({
      resource_group: DEFAULT_RESOURCE_GROUP,
    });
    // console.log('describe resource group', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.resource_group).toHaveProperty('name');
    expect(res.resource_group).toHaveProperty('num_available_node');
    expect(res.resource_group).toHaveProperty('capacity');
    expect(typeof res.resource_group.name).toBe('string');
    expect(typeof res.resource_group.num_available_node).toBe('number');
    expect(typeof res.resource_group.capacity).toBe('number');
  });

  it(`Transfer node to another rg should be successful`, async () => {
    if (runRgTransferTest) {
      const res = await milvusClient.resourceManager.transferNode({
        source_resource_group: DEFAULT_RESOURCE_GROUP,
        target_resource_group: resource_group,
        num_node: 1,
      });

      // console.log('transferNode', res);
      expect(res.error_code).toEqual(ErrorCode.SUCCESS);
    }
  });

  it(`Transfer replica to another rg should be successful`, async () => {
    if (runRgTransferTest) {
      // load col with replica
      await milvusClient.collectionManager.loadCollectionSync({
        collection_name: COLLECTION_NAME,
        replica_number: 2,
        resource_groups: [DEFAULT_RESOURCE_GROUP],
      });

      const res = await milvusClient.resourceManager.transferReplica({
        source_resource_group: DEFAULT_RESOURCE_GROUP,
        target_resource_group: resource_group,
        collection_name: COLLECTION_NAME,
        num_replica: 1,
      });

      // console.log('transfer replica', res);
      expect(res.error_code).toEqual(ErrorCode.SUCCESS);

      // release collection
      await milvusClient.collectionManager.releaseCollection({
        collection_name: COLLECTION_NAME,
      });
    }
  });

  it(`Drop a resource group should be successful`, async () => {
    // drop rg
    const res = await milvusClient.resourceManager.dropResourceGroup({
      resource_group: resource_group3,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Drop all resource groups should be successful`, async () => {
    const res = await milvusClient.resourceManager.dropAllResourceGroups();
    res.forEach(r => {
      expect(r.error_code).toEqual(ErrorCode.SUCCESS);
    });
  });
});
