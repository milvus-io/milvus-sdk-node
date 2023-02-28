import { MilvusClient } from '../milvus';
import { IP } from '../const';
import { ErrorCode } from '../milvus/types/Response';
import {
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../utils/test';
import { ERROR_REASONS } from '../milvus/const/ErrorReason';
import { timeoutTest } from './common/timeout';

const milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();
const PARTITION_NAME = GENERATE_NAME('partition');

describe('Collection Api', () => {
  beforeAll(async () => {
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

  it(`Create Partition`, async () => {
    const res = await milvusClient.partitionManager.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Has Partition`, async () => {
    const res = await milvusClient.partitionManager.hasPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.value).toEqual(true);
  });

  it(`Has not exist Partition `, async () => {
    const res = await milvusClient.partitionManager.hasPartition({
      collection_name: COLLECTION_NAME,
      partition_name: '123',
    });

    expect(res.value).toEqual(false);
  });

  it(`Show all Partitions `, async () => {
    const res = await milvusClient.partitionManager.showPartitions({
      collection_name: COLLECTION_NAME,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.partition_names).toEqual(['_default', PARTITION_NAME]);
    expect(res.partitionIDs.length).toEqual(2);
  });

  it(
    `Test show all partitions should timeout`,
    timeoutTest(
      milvusClient.partitionManager.showPartitions.bind(
        milvusClient.partitionManager
      ),
      {
        collection_name: COLLECTION_NAME,
      }
    )
  );

  it(`Get partition statistics`, async () => {
    const res = await milvusClient.partitionManager.getPartitionStatistics({
      collection_name: COLLECTION_NAME,
      partition_name: '_default',
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.stats[0].value).toEqual('0');
  });

  it('Drop partition should throw COLLECTION_PARTITION_NAME_ARE_REQUIRED', async () => {
    try {
      await milvusClient.partitionManager.dropPartition({
        collection_name: COLLECTION_NAME,
      } as any);
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.COLLECTION_PARTITION_NAME_ARE_REQUIRED
      );
    }
  });

  it('Drop partition should success', async () => {
    const res = await milvusClient.partitionManager.dropPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Check droped partition`, async () => {
    const res = await milvusClient.partitionManager.hasPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });

    expect(res.value).toEqual(false);
  });

  it(`Load Partition should throw PARTITION_NAMES_IS_REQUIRED`, async () => {
    try {
      await milvusClient.partitionManager.loadPartitions({
        collection_name: COLLECTION_NAME,
        partition_names: [],
      });
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.PARTITION_NAMES_IS_REQUIRED);
    }
  });

  it(`Load Partition should success`, async () => {
    const res = await milvusClient.partitionManager.loadPartitions({
      collection_name: COLLECTION_NAME,
      partition_names: ['_default'],
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Release Partition should throw PARTITION_NAMES_IS_REQUIRED`, async () => {
    try {
      await milvusClient.partitionManager.releasePartitions({
        collection_name: COLLECTION_NAME,
        partition_names: [],
      });
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.PARTITION_NAMES_IS_REQUIRED);
    }
  });

  it(`Release Partition should success`, async () => {
    const res = await milvusClient.partitionManager.releasePartitions({
      collection_name: COLLECTION_NAME,
      partition_names: ['_default'],
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
