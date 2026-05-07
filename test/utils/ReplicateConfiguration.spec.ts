import { ErrorCode, MilvusClient } from '../../milvus';

describe('Replicate configuration API', () => {
  const createClient = () => {
    const client = new MilvusClient({
      address: 'localhost:19530',
      __SKIP_CONNECT__: true,
    });
    const calls: { method: string; params: any; options: any }[] = [];
    (client as any).channelPool = {
      acquire: jest.fn().mockResolvedValue({
        UpdateReplicateConfiguration: (params: any, options: any, cb: any) => {
          calls.push({
            method: 'UpdateReplicateConfiguration',
            params,
            options,
          });
          cb(null, { error_code: ErrorCode.SUCCESS, reason: '' });
        },
        GetReplicateConfiguration: (params: any, options: any, cb: any) => {
          calls.push({ method: 'GetReplicateConfiguration', params, options });
          cb(null, {
            status: { error_code: ErrorCode.SUCCESS, reason: '' },
            configuration: {
              clusters: [
                {
                  cluster_id: 'source-cluster',
                  connection_param: {
                    uri: 'http://source:19530',
                    token: 'source-token',
                  },
                  pchannels: ['source-pchannel'],
                },
              ],
              cross_cluster_topology: [
                {
                  source_cluster_id: 'source-cluster',
                  target_cluster_id: 'target-cluster',
                },
              ],
            },
          });
        },
      }),
      release: jest.fn(),
    };

    return { client, calls };
  };

  it('should update replicate configuration', async () => {
    const { client, calls } = createClient();

    const res = await client.updateReplicateConfiguration({
      clusters: [
        {
          cluster_id: 'source-cluster',
          connection_param: {
            uri: 'http://source:19530',
            token: 'source-token',
          },
          pchannels: ['source-pchannel'],
        },
        {
          cluster_id: 'target-cluster',
          connection_param: {
            uri: 'http://target:19530',
            token: 'target-token',
          },
        },
      ],
      cross_cluster_topology: [
        {
          source_cluster_id: 'source-cluster',
          target_cluster_id: 'target-cluster',
        },
      ],
      force_promote: true,
      timeout: 1000,
    });

    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
    expect(calls[0]).toEqual(
      expect.objectContaining({
        method: 'UpdateReplicateConfiguration',
        params: {
          replicate_configuration: {
            clusters: [
              {
                cluster_id: 'source-cluster',
                connection_param: {
                  uri: 'http://source:19530',
                  token: 'source-token',
                },
                pchannels: ['source-pchannel'],
              },
              {
                cluster_id: 'target-cluster',
                connection_param: {
                  uri: 'http://target:19530',
                  token: 'target-token',
                },
              },
            ],
            cross_cluster_topology: [
              {
                source_cluster_id: 'source-cluster',
                target_cluster_id: 'target-cluster',
              },
            ],
          },
          force_promote: true,
        },
      })
    );
    expect(calls[0].options.deadline).toBeInstanceOf(Date);
  });

  it('should default optional update fields', async () => {
    const { client, calls } = createClient();

    await client.update_replicate_configuration({
      clusters: [
        {
          cluster_id: 'source-cluster',
          connection_param: { uri: 'http://source:19530' },
        },
      ],
    });

    expect(calls[0].params).toEqual({
      replicate_configuration: {
        clusters: [
          {
            cluster_id: 'source-cluster',
            connection_param: { uri: 'http://source:19530' },
          },
        ],
        cross_cluster_topology: [],
      },
      force_promote: false,
    });
  });

  it('should reject update without clusters', async () => {
    const { client } = createClient();

    await expect(
      client.updateReplicateConfiguration({} as any)
    ).rejects.toThrow('The `clusters` property is missing.');
  });

  it('should get replicate configuration', async () => {
    const { client, calls } = createClient();

    const res = await client.getReplicateConfiguration({ timeout: 1000 });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.configuration.clusters[0]).toEqual({
      cluster_id: 'source-cluster',
      connection_param: {
        uri: 'http://source:19530',
        token: 'source-token',
      },
      pchannels: ['source-pchannel'],
    });
    expect(calls[0]).toEqual(
      expect.objectContaining({
        method: 'GetReplicateConfiguration',
        params: {},
      })
    );
  });
});
