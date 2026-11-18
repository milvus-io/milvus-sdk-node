import { HttpBaseClient } from '../HttpClient';
import {
  Constructor,
  FetchOptions,
  HttpBaseResponse,
  HttpGetSegmentsInfoReq,
  HttpGetSegmentsInfoResult,
} from '../types';
import { parseInt64Fields } from './parseInt64Fields';

const segmentInt64Fields = new Set([
  'segmentID',
  'collectionID',
  'partitionID',
  'numRows',
  'fieldID',
  'logIDs',
]);
const maxInt64 = BigInt('9223372036854775807');

function encodeId(id: string | number) {
  const decimal = String(id);
  if (
    (typeof id === 'number' && !Number.isSafeInteger(id)) ||
    !/^(?:0|[1-9]\d{0,18})$/.test(decimal) ||
    BigInt(decimal) > maxInt64
  ) {
    throw new Error(
      'Segment and collection IDs must be nonnegative int64 values. Use decimal strings for large IDs.'
    );
  }
  return decimal;
}

export function Diagnostics<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    /** Gets metadata and binlog IDs for the given segments. */
    getSegmentsInfo(params: HttpGetSegmentsInfoReq, options?: FetchOptions) {
      const collectionID = encodeId(params.collectionID ?? 0);
      const segmentIDs = params.segmentIDs.map(encodeId);
      return this.POST<HttpBaseResponse<HttpGetSegmentsInfoResult>>(
        '/vectordb/segments/describe',
        { ...params },
        options,
        body => parseInt64Fields(body, segmentInt64Fields),
        ({ dbName }) =>
          `{"dbName":${JSON.stringify(
            dbName
          )},"collectionID":${collectionID},"segmentIDs":[${segmentIDs.join(
            ','
          )}]}`
      );
    }

    /** Returns the quota center's metrics as JSON text. */
    getQuotaMetrics(options?: FetchOptions) {
      return this.POST<HttpBaseResponse<string>>(
        '/vectordb/quotacenter/describe',
        {},
        options
      );
    }
  };
}
