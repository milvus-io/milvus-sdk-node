import {
  ConsistencyLevelEnum,
  DataType,
  ExportSnapshotState,
  HttpClient,
  IndexType,
  MetricType,
  RestoreSnapshotState,
} from '../../milvus';
import { GENERATE_NAME, IP } from '../fixtures';
import { TestS3Client } from '../fixtures/s3';
import { expectHttpSuccess, expectSuccess } from '../support/assertions';
import { createClient } from '../support/client';
import { waitFor } from '../support/wait';

describe('REST snapshot APIs', () => {
  const database = GENERATE_NAME('http_snapshot_db');
  const collectionName = GENERATE_NAME('snapshot_source');
  const localTarget = GENERATE_NAME('snapshot_local');
  const externalTarget = GENERATE_NAME('snapshot_external');
  const snapshotName = GENERATE_NAME('http_snapshot');
  const exportPrefix = GENERATE_NAME('http_snapshot_bundle');
  const snapshot = { collectionName, snapshotName };
  const client = createClient({ address: IP });
  const http = new HttpClient({ endpoint: `http://${IP}`, database });
  const s3 = new TestS3Client({
    endPoint: process.env.MINIO_ADDRESS || '127.0.0.1',
    port: 9000,
    useSSL: false,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
  });

  beforeAll(async () => {
    expectSuccess(await client.createDatabase({ db_name: database }));
    await client.use({ db_name: database });
    expectSuccess(
      await client.createCollection({
        collection_name: collectionName,
        fields: [
          { name: 'id', data_type: DataType.Int64, is_primary_key: true },
          { name: 'vector', data_type: DataType.FloatVector, dim: 2 },
        ],
      })
    );
    expectSuccess(
      await client.createIndex({
        collection_name: collectionName,
        field_name: 'vector',
        index_type: IndexType.AUTOINDEX,
        metric_type: MetricType.L2,
      })
    );
    expectSuccess(
      await client.insert({
        collection_name: collectionName,
        data: [
          { id: 1, vector: [0.1, 0.2] },
          { id: 2, vector: [0.2, 0.3] },
        ],
      })
    );

    const flush = await client.flush({ collection_names: [collectionName] });
    expectSuccess(flush.status);
    const flushTs = flush.coll_flush_ts?.[collectionName];
    if (!flushTs) throw new Error('Missing source flush timestamp');
    await waitFor(
      'snapshot source channel checkpoint',
      async () => {
        const result = await client.getFlushState({
          collection_name: collectionName,
          flush_ts: flushTs,
        });
        expectSuccess(result.status);
        return result.flushed;
      },
      flushed => flushed,
      { timeout: 45_000 }
    );
  }, 60_000);

  afterAll(async () => {
    await client.dropSnapshot({
      collection_name: collectionName,
      snapshot_name: snapshotName,
    });
    for (const name of [localTarget, externalTarget, collectionName]) {
      await client.dropCollection({ collection_name: name });
    }
    await client.dropDatabase({ db_name: database });
    await s3.removePrefix('a-bucket', `${exportPrefix}/`);
  });

  it('creates, exports, restores and removes a snapshot with exact job IDs', async () => {
    const description = 'snapshot note contains "jobId":9007199254740993';
    expectHttpSuccess(await http.createSnapshot({ ...snapshot, description }));

    const listed = await http.listSnapshots({ collectionName });
    expectHttpSuccess(listed);
    expect(listed.data).toContain(snapshotName);
    expect(listed.snapshotSummaries).toContainEqual(
      expect.objectContaining({ name: snapshotName, description })
    );
    const described = await http.describeSnapshot(snapshot);
    expectHttpSuccess(described);
    expect(described.data).toMatchObject({
      snapshotName,
      collectionName,
      description,
      createTs: expect.stringMatching(/^\d+$/),
    });

    const pinned = await http.pinSnapshotData({ ...snapshot, ttlSeconds: 60 });
    expectHttpSuccess(pinned);
    expect(pinned.data.pinId).toMatch(/^\d+$/);
    expectHttpSuccess(
      await http.unpinSnapshotData({ pinId: pinned.data.pinId })
    );

    const restored = await http.restoreSnapshot({
      snapshotName,
      sourceCollectionName: collectionName,
      targetCollectionName: localTarget,
    });
    expectHttpSuccess(restored);
    const exporting = await http.exportSnapshot({
      ...snapshot,
      targetS3Path: exportPrefix,
    });
    expectHttpSuccess(exporting);
    const exported = await waitFor(
      'REST snapshot export',
      async () => {
        const result = await http.getExportSnapshotState({
          jobId: exporting.data.jobId,
        });
        expectHttpSuccess(result);
        return result.data;
      },
      info =>
        info.state === ExportSnapshotState.ExportSnapshotCompleted ||
        info.state === ExportSnapshotState.ExportSnapshotFailed,
      { timeout: 90_000, interval: 500 }
    );
    expect(exported).toMatchObject({
      state: ExportSnapshotState.ExportSnapshotCompleted,
      jobId: exporting.data.jobId,
      snapshotMetadataURI: expect.stringContaining(exportPrefix),
    });

    const externalRestore = await http.restoreExternalSnapshot({
      targetCollectionName: externalTarget,
      snapshotMetadataURI: exported.snapshotMetadataURI,
    });
    expectHttpSuccess(externalRestore);
    for (const [jobId, collection] of [
      [restored.data.jobId, localTarget],
      [externalRestore.data.jobId, externalTarget],
    ]) {
      const info = await waitFor(
        `REST restore ${jobId}`,
        async () => {
          const result = await http.getRestoreSnapshotState({ jobId });
          expectHttpSuccess(result);
          return result.data;
        },
        job =>
          job.state === RestoreSnapshotState.RestoreSnapshotCompleted ||
          job.state === RestoreSnapshotState.RestoreSnapshotFailed,
        { timeout: 90_000, interval: 500 }
      );
      expect(info).toMatchObject({
        jobId,
        collectionName: collection,
        state: RestoreSnapshotState.RestoreSnapshotCompleted,
      });
      expectSuccess(
        await client.loadCollectionSync({ collection_name: collection })
      );
      const count = await client.count({
        collection_name: collection,
        consistency_level: ConsistencyLevelEnum.Strong,
      });
      expectSuccess(count.status);
      expect(count.data).toBe(2);
    }

    const jobs = await http.listRestoreSnapshotJobs();
    expectHttpSuccess(jobs);
    expect(jobs.data.records.map(job => job.jobId)).toEqual(
      expect.arrayContaining([restored.data.jobId, externalRestore.data.jobId])
    );
    expectHttpSuccess(await http.dropSnapshot(snapshot));
    const afterDrop = await http.listSnapshots({ collectionName });
    expectHttpSuccess(afterDrop);
    expect(afterDrop.data).not.toContain(snapshotName);
  }, 240_000);
});
