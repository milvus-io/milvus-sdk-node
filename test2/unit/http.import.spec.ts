import { HttpClient } from '../../milvus';

describe('HTTP Import API', () => {
  const baseURL = 'http://127.0.0.1:19530/v2';

  const createClient = () => {
    const requests: { url: string; body: any }[] = [];
    const fetch = jest
      .fn()
      .mockImplementation(async (url: string, init: any) => {
        requests.push({ url, body: JSON.parse(init.body) });
        return {
          ok: true,
          json: async () => ({
            code: 0,
            data: { jobId: 'job-1', records: [] },
          }),
        };
      });

    const client = new HttpClient({
      baseURL,
      token: 'token',
      database: 'default',
      fetch: fetch as any,
    });

    return { client, requests };
  };

  it('should pass projectId and regionId when creating import jobs', async () => {
    const { client, requests } = createClient();

    await client.createImportJobs({
      collectionName: 'test_collection',
      files: [['s3://bucket/path/file.parquet']],
      projectId: 'proj-xxx',
      regionId: 'aws-us-west-2',
    });

    expect(requests[0].url).toEqual(`${baseURL}/vectordb/jobs/import/create`);
    expect(requests[0].body).toEqual(
      expect.objectContaining({
        dbName: 'default',
        collectionName: 'test_collection',
        files: [['s3://bucket/path/file.parquet']],
        projectId: 'proj-xxx',
        regionId: 'aws-us-west-2',
      })
    );
  });

  it('should pass projectId and regionId when listing import jobs', async () => {
    const { client, requests } = createClient();

    await client.listImportJobs({
      collectionName: 'test_collection',
      projectId: 'proj-xxx',
      regionId: 'aws-us-west-2',
    });

    expect(requests[0].url).toEqual(`${baseURL}/vectordb/jobs/import/list`);
    expect(requests[0].body).toEqual(
      expect.objectContaining({
        dbName: 'default',
        collectionName: 'test_collection',
        projectId: 'proj-xxx',
        regionId: 'aws-us-west-2',
      })
    );
  });

  it('should pass projectId and regionId when getting import job progress', async () => {
    const { client, requests } = createClient();

    await client.getImportJobProgress({
      jobId: 'job-1',
      projectId: 'proj-xxx',
      regionId: 'aws-us-west-2',
    });

    expect(requests[0].url).toEqual(
      `${baseURL}/vectordb/jobs/import/get_progress`
    );
    expect(requests[0].body).toEqual(
      expect.objectContaining({
        dbName: 'default',
        jobId: 'job-1',
        projectId: 'proj-xxx',
        regionId: 'aws-us-west-2',
      })
    );
  });
});
