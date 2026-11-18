import { HttpClient } from '../../milvus';

describe('HTTP external refresh job IDs', () => {
  const jobId = '9223372036854775807';

  it('writes the full job ID as an unquoted JSON integer and reads it as a string', async () => {
    const fetch = jest.fn(async (_url: string, _init: RequestInit) => {
      return new Response(`{"code":0,"data":{"jobId":${jobId}}}`);
    });
    const client = new HttpClient({ baseURL: 'https://example.com/v2', fetch });

    const result = await client.getRefreshExternalCollectionProgress({ jobId });
    expect(result.data.jobId).toBe(jobId);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(
      'https://example.com/v2/vectordb/jobs/external_collection/describe'
    );
    expect(init.body).toContain(`"jobId":${jobId}`);
  });

  it.each(['9223372036854775808', '1e18', 1, '0'])(
    'rejects %s before sending a request',
    async value => {
      const fetch = jest.fn();
      const client = new HttpClient({
        baseURL: 'https://example.com/v2',
        fetch,
      });
      await expect(
        client.getRefreshExternalCollectionProgress({ jobId: value as string })
      ).rejects.toThrow('jobId must be a positive int64 decimal string');
      expect(fetch).not.toHaveBeenCalled();
    }
  );
});
