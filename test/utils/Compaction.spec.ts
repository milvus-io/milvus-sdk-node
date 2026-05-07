import { ErrorCode, MilvusClient } from '../../milvus';

describe('utils/Compaction', () => {
  it('should forward advanced compaction params to ManualCompaction', async () => {
    const client = new MilvusClient({
      address: 'localhost:19530',
      __SKIP_CONNECT__: true,
    });

    let describeParams: any;
    let compactionParams: any;
    (client as any).channelPool = {
      acquire: jest.fn().mockResolvedValue({
        DescribeCollection: (params: any, _options: any, cb: any) => {
          describeParams = params;
          cb(null, {
            status: { error_code: ErrorCode.SUCCESS, reason: '' },
            collectionID: '100',
            schema: { fields: [], functions: [] },
            consistency_level: 'Bounded',
            properties: [],
            aliases: [],
            virtual_channel_names: [],
            physical_channel_names: [],
            start_positions: [],
          });
        },
        ManualCompaction: (params: any, _options: any, cb: any) => {
          compactionParams = params;
          cb(null, {
            status: { error_code: ErrorCode.SUCCESS, reason: '' },
            compactionID: '1',
            compactionPlanCount: 1,
          });
        },
      }),
      release: jest.fn(),
    };

    const res = await client.compact({
      collection_name: 'test_collection',
      db_name: 'test_db',
      timetravel: '123',
      majorCompaction: true,
      partition_id: '456',
      channel: 'by-dev-rootcoord-dml_0',
      segment_ids: [111, 222],
      l0Compaction: true,
      target_size: '536870912',
      timeout: 1000,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(describeParams).toEqual({
      collection_name: 'test_collection',
      db_name: 'test_db',
      timeout: 1000,
    });
    expect(compactionParams).toEqual({
      collection_name: 'test_collection',
      db_name: 'test_db',
      collectionID: '100',
      timetravel: '123',
      majorCompaction: true,
      partition_id: '456',
      channel: 'by-dev-rootcoord-dml_0',
      segment_ids: [111, 222],
      l0Compaction: true,
      target_size: '536870912',
    });
    expect(compactionParams).not.toHaveProperty('timeout');
  });
});
