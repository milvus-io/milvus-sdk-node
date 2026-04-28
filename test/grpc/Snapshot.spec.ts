import { DataType, ErrorCode, MilvusClient } from '../../milvus';
import { GENERATE_NAME, IP } from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });

describe('Snapshot API', () => {
  const collectionName = GENERATE_NAME('snapshot_collection');
  const restoredCollectionName = GENERATE_NAME('snapshot_restored');
  const snapshotName = GENERATE_NAME('snapshot');

  beforeAll(async () => {
    const create = await milvusClient.createCollection({
      collection_name: collectionName,
      fields: [
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
        },
        {
          name: 'vector',
          data_type: DataType.FloatVector,
          dim: 4,
        },
      ],
    });
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const insert = await milvusClient.insert({
      collection_name: collectionName,
      data: [
        { id: 1, vector: [0.1, 0.2, 0.3, 0.4] },
        { id: 2, vector: [0.2, 0.3, 0.4, 0.5] },
      ],
    });
    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);

    const flush = await milvusClient.flush({
      collection_names: [collectionName],
    });
    expect(flush.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  afterAll(async () => {
    await milvusClient.dropSnapshot({
      snapshot_name: snapshotName,
      collection_name: collectionName,
    });
    await milvusClient.dropCollection({ collection_name: collectionName });
    await milvusClient.dropCollection({
      collection_name: restoredCollectionName,
    });
  });

  it('validates required snapshot request fields before sending RPCs', async () => {
    await expect(milvusClient.createSnapshot({} as any)).rejects.toThrow(
      'The `collection_name` property is missing.'
    );

    await expect(
      milvusClient.createSnapshot({ collection_name: collectionName } as any)
    ).rejects.toThrow('The `snapshot_name` property is missing.');

    await expect(milvusClient.dropSnapshot({} as any)).rejects.toThrow(
      'The `collection_name` property is missing.'
    );

    await expect(
      milvusClient.dropSnapshot({ collection_name: collectionName } as any)
    ).rejects.toThrow('The `snapshot_name` property is missing.');

    await expect(milvusClient.listSnapshots({} as any)).rejects.toThrow(
      'The `collection_name` property is missing.'
    );

    await expect(milvusClient.describeSnapshot({} as any)).rejects.toThrow(
      'The `collection_name` property is missing.'
    );

    await expect(
      milvusClient.describeSnapshot({ collection_name: collectionName } as any)
    ).rejects.toThrow('The `snapshot_name` property is missing.');

    await expect(milvusClient.restoreSnapshot({} as any)).rejects.toThrow(
      'The `snapshot_name` property is missing.'
    );

    await expect(
      milvusClient.restoreSnapshot({ snapshot_name: snapshotName } as any)
    ).rejects.toThrow('The `source_collection_name` property is missing.');

    await expect(
      milvusClient.restoreSnapshot({
        snapshot_name: snapshotName,
        source_collection_name: collectionName,
      } as any)
    ).rejects.toThrow('The `target_collection_name` property is missing.');

    await expect(
      milvusClient.getRestoreSnapshotState({} as any)
    ).rejects.toThrow('The `job_id` property is missing.');

    await expect(milvusClient.pinSnapshotData({} as any)).rejects.toThrow(
      'The `collection_name` property is missing.'
    );

    await expect(
      milvusClient.pinSnapshotData({ collection_name: collectionName } as any)
    ).rejects.toThrow('The `snapshot_name` property is missing.');

    await expect(milvusClient.unpinSnapshotData({} as any)).rejects.toThrow(
      'The `pin_id` property is missing.'
    );
  });

  it('creates, lists, describes, pins, unpins, restores, and tracks a snapshot', async () => {
    const create = await milvusClient.createSnapshot({
      snapshot_name: snapshotName,
      collection_name: collectionName,
      description: 'node sdk snapshot test',
      compaction_protection_seconds: 0,
    });
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const snapshots = await milvusClient.listSnapshots({
      collection_name: collectionName,
    });
    expect(snapshots.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(snapshots.snapshots).toContain(snapshotName);

    const describe = await milvusClient.describeSnapshot({
      snapshot_name: snapshotName,
      collection_name: collectionName,
    });
    expect(describe.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(describe.name).toEqual(snapshotName);
    expect(describe.collection_name).toEqual(collectionName);
    expect(describe.description).toEqual('node sdk snapshot test');

    const pin = await milvusClient.pinSnapshotData({
      snapshot_name: snapshotName,
      collection_name: collectionName,
      ttl_seconds: 60,
    });
    expect(pin.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(pin.pin_id).toBeTruthy();

    const unpin = await milvusClient.unpinSnapshotData({ pin_id: pin.pin_id });
    expect(unpin.error_code).toEqual(ErrorCode.SUCCESS);

    const restore = await milvusClient.restoreSnapshot({
      snapshot_name: snapshotName,
      source_collection_name: collectionName,
      target_collection_name: restoredCollectionName,
    });
    expect(restore.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(restore.job_id).toBeTruthy();

    const state = await milvusClient.getRestoreSnapshotState({
      job_id: restore.job_id,
    });
    expect(state.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(state.info.snapshot_name).toEqual(snapshotName);

    const jobs = await milvusClient.listRestoreSnapshotJobs({
      collection_name: restoredCollectionName,
    });
    expect(jobs.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(jobs.jobs.some(job => job.job_id === restore.job_id)).toBe(true);

    const allJobs = await milvusClient.listRestoreSnapshotJobs();
    expect(allJobs.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(allJobs.jobs.some(job => job.job_id === restore.job_id)).toBe(true);
  });
});
