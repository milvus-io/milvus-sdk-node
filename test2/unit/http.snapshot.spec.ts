import { HttpClient } from '../../milvus';

describe('HTTP snapshot responses', () => {
  it('preserves int64 job IDs and sends explicit source and target databases', async () => {
    const jobId = '9223372036854775807';
    const note = 'quoted "jobId":9007199254740993';
    const response = `{"code":0,"data":{"jo\\u0062Id":${jobId},"reason":${JSON.stringify(
      note
    )}}}`;
    const fetch = jest.fn(
      async (_url: string, _init: RequestInit) => new Response(response)
    );
    const client = new HttpClient({
      baseURL: 'https://example.com/v2',
      database: 'configured',
      fetch,
    });

    const result = await client.restoreSnapshot({
      snapshotName: 'backup',
      sourceCollectionName: 'source',
      sourceDbName: 'source_db',
      targetCollectionName: 'restored',
      targetDbName: 'target_db',
    });
    expect(result.data).toEqual({ jobId, reason: note });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://example.com/v2/vectordb/snapshots/restore');
    expect(JSON.parse(init.body as string)).toMatchObject({
      sourceDbName: 'source_db',
      targetDbName: 'target_db',
    });
  });
});
