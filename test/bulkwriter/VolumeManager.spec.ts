import { VolumeManager, VolumeType } from '../../milvus';

describe('VolumeManager', () => {
  const cloudEndpoint = 'https://api.cloud.zilliz.com';
  const apiKey = 'api-key';

  const createManager = () => {
    const requests: { url: string; init: RequestInit }[] = [];
    const fetch = jest
      .fn()
      .mockImplementation(async (url: string, init: any) => {
        requests.push({ url, init });
        return {
          ok: true,
          json: async () => ({ code: 0, data: { volumeName: 'vol-1' } }),
        };
      });

    return {
      manager: new VolumeManager({
        cloudEndpoint,
        apiKey,
        fetch: fetch as any,
      }),
      requests,
    };
  };

  it('should create a managed volume', async () => {
    const { manager, requests } = createManager();

    const res = await manager.createVolume({
      projectId: 'proj-xxx',
      regionId: 'aws-us-west-2',
      volumeName: 'managed-volume',
    });

    expect(res.code).toBe(0);
    expect(requests[0].url).toBe(`${cloudEndpoint}/v2/volumes/create`);
    expect(requests[0].init.method).toBe('POST');
    expect(requests[0].init.headers).toEqual({
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ContentType: 'application/json',
    });
    expect(JSON.parse(requests[0].init.body as string)).toEqual({
      projectId: 'proj-xxx',
      regionId: 'aws-us-west-2',
      volumeName: 'managed-volume',
    });
  });

  it('should create an external volume', async () => {
    const { manager, requests } = createManager();

    await manager.createVolume({
      projectId: 'proj-xxx',
      regionId: 'aws-us-west-2',
      volumeName: 'external-volume',
      type: VolumeType.EXTERNAL,
      storageIntegrationId: 'si-xxx',
      path: 's3://bucket/path/',
    });

    expect(JSON.parse(requests[0].init.body as string)).toEqual({
      projectId: 'proj-xxx',
      regionId: 'aws-us-west-2',
      volumeName: 'external-volume',
      type: VolumeType.EXTERNAL,
      storageIntegrationId: 'si-xxx',
      path: 's3://bucket/path/',
    });
  });

  it('should list volumes with type filter', async () => {
    const { manager, requests } = createManager();

    await manager.listVolumes({
      projectId: 'proj-xxx',
      currentPage: 2,
      pageSize: 20,
      type: VolumeType.EXTERNAL,
    });

    expect(requests[0].url).toBe(
      `${cloudEndpoint}/v2/volumes?projectId=proj-xxx&currentPage=2&pageSize=20&type=EXTERNAL`
    );
    expect(requests[0].init.method).toBe('GET');
  });

  it('should describe a volume', async () => {
    const { manager, requests } = createManager();

    await manager.describeVolume({ volumeName: 'volume/name' });

    expect(requests[0].url).toBe(`${cloudEndpoint}/v2/volumes/volume%2Fname`);
    expect(requests[0].init.method).toBe('GET');
  });

  it('should delete a volume', async () => {
    const { manager, requests } = createManager();

    await manager.deleteVolume({ volumeName: 'volume/name' });

    expect(requests[0].url).toBe(`${cloudEndpoint}/v2/volumes/volume%2Fname`);
    expect(requests[0].init.method).toBe('DELETE');
  });

  it('should apply a volume', async () => {
    const { manager, requests } = createManager();

    await manager.applyVolume({ volumeName: 'volume-name', path: '/data/' });

    expect(requests[0].url).toBe(`${cloudEndpoint}/v2/volumes/apply`);
    expect(requests[0].init.method).toBe('POST');
    expect(JSON.parse(requests[0].init.body as string)).toEqual({
      volumeName: 'volume-name',
      path: '/data/',
    });
  });

  it('should support constructor overload with endpoint and api key', async () => {
    const requests: { url: string; init: RequestInit }[] = [];
    const fetch = jest
      .fn()
      .mockImplementation(async (url: string, init: any) => {
        requests.push({ url, init });
        return {
          ok: true,
          json: async () => ({ code: 0, data: {} }),
        };
      });
    const manager = new VolumeManager(
      `${cloudEndpoint}/`,
      apiKey,
      fetch as any
    );

    await manager.create_volume({
      projectId: 'proj-xxx',
      regionId: 'aws-us-west-2',
      volumeName: 'managed-volume',
    });

    expect(requests[0].url).toBe(`${cloudEndpoint}/v2/volumes/create`);
  });

  it('should throw for non-ok HTTP responses with response text', async () => {
    const fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'boom',
    });
    const manager = new VolumeManager({
      cloudEndpoint,
      apiKey,
      fetch: fetch as any,
    });

    await expect(
      manager.describe_volume({ volumeName: 'volume-name' })
    ).rejects.toThrow(
      `HTTP 500 Internal Server Error: ${cloudEndpoint}/v2/volumes/volume-name - boom`
    );
  });
});
