import { createClient } from '../support/client';
import { expectSuccess } from '../support/assertions';
import {
  MilvusClient,
  ERROR_REASONS,
  LoadState,
  ShowPartitionsType,
} from '../../milvus';
import {
  IP,
  collectionSchema,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../fixtures';
import { timeoutTest } from '../fixtures';

const milvusClient = createClient({ address: IP, logLevel: 'info' });
const COLLECTION_NAME = GENERATE_NAME();
const PARTITION_NAME = GENERATE_NAME('partition');
const dbParam = {
  db_name: 'Partition',
};

describe(`Partition API`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
    await milvusClient.createCollection(
      collectionSchema({ collectionName: COLLECTION_NAME, dim: [128] })
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

  it(`Create Partition`, async () => {
    const res = await milvusClient.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
    const createNewPartition = await milvusClient.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: 'new',
    });
    expectSuccess(res);
    expectSuccess(createNewPartition);
  });

  it(`Has Partition`, async () => {
    const res = await milvusClient.hasPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });

    expectSuccess(res.status);
    expect(res.value).toEqual(true);
  });

  it(`Has not exist Partition `, async () => {
    const res = await milvusClient.hasPartition({
      collection_name: COLLECTION_NAME,
      partition_name: '123',
    });

    expect(res.value).toEqual(false);
  });

  it(`Show all Partitions `, async () => {
    const res = await milvusClient.showPartitions({
      collection_name: COLLECTION_NAME,
    });

    expectSuccess(res.status);
    expect(res.partition_names).toEqual(['_default', PARTITION_NAME, 'new']);
    expect(res.partitionIDs.length).toEqual(3);

    const list = await milvusClient.listPartitions({
      collection_name: COLLECTION_NAME,
    });

    expectSuccess(list.status);
    expect(list.partition_names).toEqual(res.partition_names);
    expect(list.partitionIDs.length).toEqual(res.partitionIDs.length);
    expect(list.data.length).toEqual(res.data.length);
    const resultKeys = Object.keys(list.data[0]);
    expect(resultKeys).toContain('name');
    expect(resultKeys).toContain('id');
    expect(resultKeys).toContain('timestamp');
    expect(resultKeys).toContain('loadedPercentage');
  });

  it(
    `Test show all partitions should timeout`,
    timeoutTest(milvusClient.showPartitions.bind(milvusClient), {
      collection_name: COLLECTION_NAME,
    })
  );

  it(`Get partition statistics`, async () => {
    const res = await milvusClient.getPartitionStatistics({
      collection_name: COLLECTION_NAME,
      partition_name: '_default',
    });

    expectSuccess(res.status);
    expect(res.stats[0].value).toEqual('0');

    // alias
    const alias = await milvusClient.getPartitionStatistics({
      collection_name: COLLECTION_NAME,
      partition_name: '_default',
    });
    expect(alias.stats[0].value).toEqual(res.stats[0].value);
    expect(alias.data.row_count).toEqual(res.data.row_count);
  });

  it(`load partition should success`, async () => {
    const load = await milvusClient.loadPartitionsSync({
      collection_name: COLLECTION_NAME,
      partition_names: [PARTITION_NAME],
    });

    const loadstate = await milvusClient.getLoadState({
      collection_name: COLLECTION_NAME,
      partition_names: [PARTITION_NAME],
    });

    expectSuccess(load);
    expect(loadstate.state).toEqual(LoadState.LoadStateLoaded);

    const loadedPartitions = await milvusClient.showPartitions({
      collection_name: COLLECTION_NAME,
      type: ShowPartitionsType.Loaded,
    });

    expectSuccess(loadedPartitions.status);
    expect(loadedPartitions.partition_names).toEqual([PARTITION_NAME]);
    expect(loadedPartitions.partitionIDs.length).toEqual(1);
    expect(loadedPartitions.data.length).toEqual(1);
    expect(loadedPartitions.data[0].name).toEqual(PARTITION_NAME);
    expect(loadedPartitions.data[0].loadedPercentage).toEqual('100');
    expect(loadedPartitions.data[0].id).toEqual(
      loadedPartitions.partitionIDs[0]
    );
    expect(loadedPartitions.data[0].timestamp).toBeDefined();

    const collectionLoadState = await milvusClient.getLoadState({
      collection_name: COLLECTION_NAME,
    });
    expect(collectionLoadState.state).toEqual(LoadState.LoadStateLoaded);
  });

  it(`create new partition should success`, async () => {
    const newLoadState = await milvusClient.getLoadState({
      collection_name: COLLECTION_NAME,
      partition_names: ['new'],
    });

    expect(newLoadState.state).toEqual(LoadState.LoadStateNotLoad);
  });

  it(`release partition should success`, async () => {
    const res = await milvusClient.releasePartitions({
      collection_name: COLLECTION_NAME,
      partition_names: [PARTITION_NAME],
    });

    const loadstate = await milvusClient.getLoadState({
      collection_name: COLLECTION_NAME,
    });

    expect(loadstate.state).toEqual(LoadState.LoadStateNotLoad);
    expectSuccess(res);
  });

  it(`Drop partition should throw COLLECTION_PARTITION_NAME_ARE_REQUIRED`, async () => {
    await expect(
      milvusClient.dropPartition({
        collection_name: COLLECTION_NAME,
      } as any)
    ).rejects.toThrow(
      new Error(ERROR_REASONS.COLLECTION_PARTITION_NAME_ARE_REQUIRED)
    );
  });

  it(`Drop partition should success`, async () => {
    const drop = await milvusClient.dropPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
    expectSuccess(drop);
  });

  it(`Check droped partition`, async () => {
    const res = await milvusClient.hasPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });

    expect(res.value).toEqual(false);
  });

  it(`Load Partition should throw PARTITION_NAMES_IS_REQUIRED`, async () => {
    await expect(
      milvusClient.loadPartitions({
        collection_name: COLLECTION_NAME,
        partition_names: [],
      })
    ).rejects.toThrow(new Error(ERROR_REASONS.PARTITION_NAMES_IS_REQUIRED));
  });

  it(`Load Partition should success`, async () => {
    const res = await milvusClient.loadPartitions({
      collection_name: COLLECTION_NAME,
      partition_names: ['_default'],
    });
    expectSuccess(res);
  });

  it(`Release Partition should throw PARTITION_NAMES_IS_REQUIRED`, async () => {
    await expect(
      milvusClient.releasePartitions({
        collection_name: COLLECTION_NAME,
        partition_names: [],
      })
    ).rejects.toThrow(new Error(ERROR_REASONS.PARTITION_NAMES_IS_REQUIRED));
  });

  it(`Release Partition should success`, async () => {
    const res = await milvusClient.releasePartitions({
      collection_name: COLLECTION_NAME,
      partition_names: ['_default'],
    });
    expectSuccess(res);
  });
});
