import {
  MilvusClient,
  ErrorCode,
  ERROR_REASONS,
  LoadState,
} from '../../milvus';
import {
  IP,
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../tools';
import { timeoutTest } from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
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

  it(`Create Partition`, async () => {
    const res = await milvusClient.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
    const createNewPartition = await milvusClient.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: 'new',
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
    expect(createNewPartition.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Has Partition`, async () => {
    const res = await milvusClient.hasPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
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

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.partition_names).toEqual(['_default', PARTITION_NAME, 'new']);
    expect(res.partitionIDs.length).toEqual(3);

    const list = await milvusClient.listPartitions({
      collection_name: COLLECTION_NAME,
    });

    expect(list.status.error_code).toEqual(ErrorCode.SUCCESS);
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

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
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

    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
    expect(loadstate.state).toEqual(LoadState.LoadStateLoaded);
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
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Drop partition should throw COLLECTION_PARTITION_NAME_ARE_REQUIRED`, async () => {
    try {
      await milvusClient.dropPartition({
        collection_name: COLLECTION_NAME,
      } as any);
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.COLLECTION_PARTITION_NAME_ARE_REQUIRED
      );
    }
  });

  it(`Drop partition should success`, async () => {
    const drop = await milvusClient.dropPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
    expect(drop.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Check droped partition`, async () => {
    const res = await milvusClient.hasPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });

    expect(res.value).toEqual(false);
  });

  it(`Load Partition should throw PARTITION_NAMES_IS_REQUIRED`, async () => {
    try {
      await milvusClient.loadPartitions({
        collection_name: COLLECTION_NAME,
        partition_names: [],
      });
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.PARTITION_NAMES_IS_REQUIRED);
    }
  });

  it(`Load Partition should success`, async () => {
    const res = await milvusClient.loadPartitions({
      collection_name: COLLECTION_NAME,
      partition_names: ['_default'],
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Release Partition should throw PARTITION_NAMES_IS_REQUIRED`, async () => {
    try {
      await milvusClient.releasePartitions({
        collection_name: COLLECTION_NAME,
        partition_names: [],
      });
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.PARTITION_NAMES_IS_REQUIRED);
    }
  });

  it(`Release Partition should success`, async () => {
    const res = await milvusClient.releasePartitions({
      collection_name: COLLECTION_NAME,
      partition_names: ['_default'],
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
