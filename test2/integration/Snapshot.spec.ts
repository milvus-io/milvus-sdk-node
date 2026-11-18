import { createClient } from '../support/client';
import { expectSuccess } from '../support/assertions';
import {
  ConsistencyLevelEnum,
  DataType,
  ExportSnapshotState,
  IndexType,
  MetricType,
  RestoreSnapshotState,
} from '../../milvus';
import { GENERATE_NAME, IP } from '../fixtures';
import { TestS3Client } from '../fixtures/s3';
import { waitFor } from '../support/wait';

const milvusClient = createClient({ address: IP, logLevel: 'info' });

describe('Snapshot API', () => {
  const collectionName = GENERATE_NAME('snapshot_collection');
  const restoredCollectionName = GENERATE_NAME('snapshot_restored');
  const snapshotName = GENERATE_NAME('snapshot');
  const portableSnapshotName = GENERATE_NAME('portable_snapshot');
  const exportPrefix = GENERATE_NAME('snapshot_bundle');
  const externalRestoreName = GENERATE_NAME('snapshot_external_restore');
  const s3 = new TestS3Client({
    endPoint: process.env.MINIO_ADDRESS || '127.0.0.1',
    port: 9000,
    useSSL: false,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
  });

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
    expectSuccess(create);

    const insert = await milvusClient.insert({
      collection_name: collectionName,
      data: [
        { id: 1, vector: [0.1, 0.2, 0.3, 0.4] },
        { id: 2, vector: [0.2, 0.3, 0.4, 0.5] },
      ],
    });
    expectSuccess(insert.status);

    const flush = await milvusClient.flush({
      collection_names: [collectionName],
    });
    expectSuccess(flush.status);
    const flushTs = flush.coll_flush_ts?.[collectionName];
    if (!flushTs)
      throw new Error('Expected a flush timestamp for the source collection');
    // Snapshots use the persisted channel checkpoint as their upper bound.
    await waitFor(
      'snapshot source flush checkpoint',
      async () => {
        const state = await milvusClient.getFlushState({
          collection_name: collectionName,
          flush_ts: flushTs,
        });
        expectSuccess(state.status);
        return state.flushed;
      },
      flushed => flushed,
      { timeout: 45_000 }
    );
  });

  afterAll(async () => {
    for (const name of [snapshotName, portableSnapshotName]) {
      await milvusClient.dropSnapshot({
        snapshot_name: name,
        collection_name: collectionName,
      });
    }
    await milvusClient.dropCollection({ collection_name: collectionName });
    await milvusClient.dropCollection({
      collection_name: restoredCollectionName,
    });
    await milvusClient.dropCollection({ collection_name: externalRestoreName });
    await s3.removePrefix('a-bucket', `${exportPrefix}/`);
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

    await expect(
      milvusClient.exportSnapshot({ collection_name: collectionName } as any)
    ).rejects.toThrow('The `snapshot_name` property is missing.');
    await expect(
      milvusClient.exportSnapshot({
        collection_name: collectionName,
        snapshot_name: snapshotName,
      } as any)
    ).rejects.toThrow('The `target_s3_path` property is missing.');
    await expect(
      milvusClient.getExportSnapshotState({} as any)
    ).rejects.toThrow('The `job_id` property is missing.');
    await expect(
      milvusClient.restoreExternalSnapshot({} as any)
    ).rejects.toThrow('The `target_collection_name` property is missing.');
    await expect(
      milvusClient.restoreExternalSnapshot({
        target_collection_name: externalRestoreName,
      } as any)
    ).rejects.toThrow('The `snapshot_metadata_uri` property is missing.');
  });

  it('creates, lists, describes, pins, unpins, restores, and tracks a snapshot', async () => {
    const create = await milvusClient.createSnapshot({
      snapshot_name: snapshotName,
      collection_name: collectionName,
      description: 'node sdk snapshot test',
      compaction_protection_seconds: 0,
    });
    expectSuccess(create);

    const snapshots = await milvusClient.listSnapshots({
      collection_name: collectionName,
    });
    expectSuccess(snapshots.status);
    expect(snapshots.snapshots).toContain(snapshotName);
    expect(snapshots.snapshot_summaries).toContainEqual(
      expect.objectContaining({
        name: snapshotName,
        description: 'node sdk snapshot test',
      })
    );

    const describe = await milvusClient.describeSnapshot({
      snapshot_name: snapshotName,
      collection_name: collectionName,
    });
    expectSuccess(describe.status);
    expect(describe.name).toEqual(snapshotName);
    expect(describe.collection_name).toEqual(collectionName);
    expect(describe.description).toEqual('node sdk snapshot test');

    const pin = await milvusClient.pinSnapshotData({
      snapshot_name: snapshotName,
      collection_name: collectionName,
      ttl_seconds: 60,
    });
    expectSuccess(pin.status);
    expect(pin.pin_id).toBeTruthy();

    const unpin = await milvusClient.unpinSnapshotData({ pin_id: pin.pin_id });
    expectSuccess(unpin);

    const restore = await milvusClient.restoreSnapshot({
      snapshot_name: snapshotName,
      source_collection_name: collectionName,
      target_collection_name: restoredCollectionName,
    });
    expectSuccess(restore.status);
    expect(restore.job_id).toBeTruthy();

    const state = await milvusClient.getRestoreSnapshotState({
      job_id: restore.job_id,
    });
    expectSuccess(state.status);
    expect(state.info.snapshot_name).toEqual(snapshotName);

    const jobs = await milvusClient.listRestoreSnapshotJobs({
      collection_name: restoredCollectionName,
    });
    expectSuccess(jobs.status);
    expect(jobs.jobs.some(job => job.job_id === restore.job_id)).toBe(true);

    const allJobs = await milvusClient.listRestoreSnapshotJobs();
    expectSuccess(allJobs.status);
    expect(allJobs.jobs.some(job => job.job_id === restore.job_id)).toBe(true);
  });

  it('exports a self-contained snapshot and restores its rows from the metadata URI', async () => {
    expectSuccess(
      await milvusClient.createSnapshot({
        snapshot_name: portableSnapshotName,
        collection_name: collectionName,
      })
    );
    const exportJob = await milvusClient.exportSnapshot({
      snapshot_name: portableSnapshotName,
      collection_name: collectionName,
      target_s3_path: exportPrefix,
    });
    expectSuccess(exportJob.status);
    const exported = await waitFor(
      'snapshot export',
      async () => {
        const result = await milvusClient.getExportSnapshotState({
          job_id: exportJob.job_id,
        });
        expectSuccess(result.status);
        if (result.info.state === ExportSnapshotState.ExportSnapshotFailed) {
          throw new Error(result.info.reason);
        }
        return result.info;
      },
      info => info.state === ExportSnapshotState.ExportSnapshotCompleted,
      { timeout: 90_000, interval: 500 }
    );
    expect(exported.snapshot_metadata_uri).toContain(exportPrefix);
    expect(BigInt(exported.total_bytes)).toBeGreaterThan(BigInt(0));

    const restoreJob = await milvusClient.restoreExternalSnapshot({
      target_collection_name: externalRestoreName,
      snapshot_metadata_uri: exported.snapshot_metadata_uri,
    });
    expectSuccess(restoreJob.status);
    await waitFor(
      'external snapshot restore',
      async () => {
        const result = await milvusClient.getRestoreSnapshotState({
          job_id: restoreJob.job_id,
        });
        expectSuccess(result.status);
        if (result.info.state === RestoreSnapshotState.RestoreSnapshotFailed) {
          throw new Error(result.info.reason);
        }
        return result.info;
      },
      info => info.state === RestoreSnapshotState.RestoreSnapshotCompleted,
      { timeout: 90_000, interval: 500 }
    );

    expectSuccess(
      await milvusClient.createIndex({
        collection_name: externalRestoreName,
        field_name: 'vector',
        index_type: IndexType.AUTOINDEX,
        metric_type: MetricType.L2,
      })
    );
    expectSuccess(
      await milvusClient.loadCollectionSync({
        collection_name: externalRestoreName,
      })
    );
    const restored = await milvusClient.query({
      collection_name: externalRestoreName,
      filter: 'id in [1, 2]',
      output_fields: ['id'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });
    expectSuccess(restored.status);
    expect(restored.data.map(row => String(row.id)).sort()).toEqual(['1', '2']);
  }, 200_000);
});
