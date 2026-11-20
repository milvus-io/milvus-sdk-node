import { ErrorCode, MilvusClient } from '../../milvus';

describe('flushSync', () => {
  it('returns the server status if it rejects the flush request', async () => {
    const status = { error_code: ErrorCode.RateLimit, reason: 'Rate limited' };
    const flush = jest.fn().mockResolvedValue({ status });
    const getFlushState = jest.fn();
    const client = { flush, getFlushState } as unknown as MilvusClient;

    await expect(
      MilvusClient.prototype.flushSync.call(client, {
        collection_names: ['data'],
      })
    ).resolves.toEqual({ status, flushed: false });
    expect(getFlushState).not.toHaveBeenCalled();
  });

  it('waits for streaming checkpoints even when there are no segment IDs yet', async () => {
    const status = { error_code: ErrorCode.SUCCESS, reason: '' };
    const flush = jest.fn().mockResolvedValue({
      status,
      coll_segIDs: { streaming: { data: [] }, legacy: { data: [42] } },
      coll_flush_ts: {
        streaming: '9007199254740993',
        legacy: '9007199254740995',
      },
    });
    const getFlushState = jest
      .fn()
      .mockResolvedValueOnce({ status, flushed: false })
      .mockResolvedValue({ status, flushed: true });
    const client = { flush, getFlushState } as unknown as MilvusClient;
    const request = {
      collection_names: ['streaming', 'legacy'],
      db_name: 'example',
      timeout: 2000,
    };

    await expect(
      MilvusClient.prototype.flushSync.call(client, request)
    ).resolves.toEqual({ status, flushed: true });
    expect(flush).toHaveBeenCalledWith(request);
    const checkpoint = {
      collection_name: 'streaming',
      db_name: 'example',
      flush_ts: '9007199254740993',
      timeout: 2000,
    };
    expect(getFlushState.mock.calls).toEqual([
      [checkpoint],
      [checkpoint],
      [{ db_name: 'example', segmentIDs: [42], timeout: 2000 }],
    ]);
  });
});
