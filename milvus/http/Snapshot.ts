import { HttpBaseClient } from '../HttpClient';
import {
  Constructor,
  FetchOptions,
  HttpBaseReq,
  HttpBaseResponse,
  HttpCreateSnapshotReq,
  HttpDescribeSnapshotResponse,
  HttpExportSnapshotJobInfo,
  HttpExportSnapshotReq,
  HttpListSnapshotsResponse,
  HttpPinSnapshotDataReq,
  HttpRestoreExternalSnapshotReq,
  HttpRestoreSnapshotJobInfo,
  HttpRestoreSnapshotReq,
  HttpSnapshotJobReq,
  HttpSnapshotJobResponse,
  HttpSnapshotReq,
} from '../types';
import { parseInt64Fields } from './parseInt64Fields';

const snapshotInt64Fields = new Set([
  'jobId',
  'pinId',
  'createTs',
  'createUtcTs',
  'startTime',
  'timeCost',
  'totalFiles',
  'copiedFiles',
  'totalBytes',
]);

const decodeSnapshot = <T>(body: string) =>
  parseInt64Fields<T>(body, snapshotInt64Fields);

/** REST v2 snapshot lifecycle and portable export jobs. */
export function Snapshot<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    get snapshotPrefix() {
      return '/vectordb/snapshots';
    }

    get snapshotJobPrefix() {
      return '/vectordb/jobs/snapshot';
    }

    createSnapshot(params: HttpCreateSnapshotReq, options?: FetchOptions) {
      return this.POST<HttpBaseResponse>(
        `${this.snapshotPrefix}/create`,
        params,
        options
      );
    }

    dropSnapshot(params: HttpSnapshotReq, options?: FetchOptions) {
      return this.POST<HttpBaseResponse>(
        `${this.snapshotPrefix}/drop`,
        params,
        options
      );
    }

    listSnapshots(params: HttpBaseReq, options?: FetchOptions) {
      return this.POST<HttpListSnapshotsResponse>(
        `${this.snapshotPrefix}/list`,
        params,
        options,
        decodeSnapshot
      );
    }

    describeSnapshot(params: HttpSnapshotReq, options?: FetchOptions) {
      return this.POST<HttpDescribeSnapshotResponse>(
        `${this.snapshotPrefix}/describe`,
        params,
        options,
        decodeSnapshot
      );
    }

    /** Restore a snapshot into a collection and return a decimal job ID. */
    restoreSnapshot(params: HttpRestoreSnapshotReq, options?: FetchOptions) {
      return this.POST<HttpSnapshotJobResponse>(
        `${this.snapshotPrefix}/restore`,
        {
          ...params,
          sourceDbName: params.sourceDbName ?? this.database,
          targetDbName: params.targetDbName ?? this.database,
        },
        options,
        decodeSnapshot
      );
    }

    pinSnapshotData(params: HttpPinSnapshotDataReq, options?: FetchOptions) {
      return this.POST<HttpBaseResponse<{ pinId: string }>>(
        `${this.snapshotPrefix}/pin`,
        params,
        options,
        decodeSnapshot
      );
    }

    unpinSnapshotData(params: { pinId: string }, options?: FetchOptions) {
      return this.POST<HttpBaseResponse>(
        `${this.snapshotPrefix}/unpin`,
        params,
        options
      );
    }

    exportSnapshot(params: HttpExportSnapshotReq, options?: FetchOptions) {
      return this.POST<HttpSnapshotJobResponse>(
        `${this.snapshotJobPrefix}/export`,
        params,
        options,
        decodeSnapshot
      );
    }

    getExportSnapshotState(params: HttpSnapshotJobReq, options?: FetchOptions) {
      return this.POST<HttpBaseResponse<HttpExportSnapshotJobInfo>>(
        `${this.snapshotJobPrefix}/export/describe`,
        params,
        options,
        decodeSnapshot
      );
    }

    restoreExternalSnapshot(
      params: HttpRestoreExternalSnapshotReq,
      options?: FetchOptions
    ) {
      return this.POST<HttpSnapshotJobResponse>(
        `${this.snapshotJobPrefix}/restore_external`,
        params,
        options,
        decodeSnapshot
      );
    }

    getRestoreSnapshotState(
      params: HttpSnapshotJobReq,
      options?: FetchOptions
    ) {
      return this.POST<HttpBaseResponse<HttpRestoreSnapshotJobInfo>>(
        `${this.snapshotJobPrefix}/describe`,
        params,
        options,
        decodeSnapshot
      );
    }

    listRestoreSnapshotJobs(
      params: Partial<HttpBaseReq> = {},
      options?: FetchOptions
    ) {
      return this.POST<
        HttpBaseResponse<{ records: HttpRestoreSnapshotJobInfo[] }>
      >(`${this.snapshotJobPrefix}/list`, params, options, decodeSnapshot);
    }
  };
}
