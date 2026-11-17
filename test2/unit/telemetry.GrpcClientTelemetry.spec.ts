import { Metadata } from '@grpc/grpc-js';
import { MilvusClient } from '../../milvus';

describe('GRPCClient telemetry transport', () => {
  function installHeartbeatCapture(client: MilvusClient, requests: any[]) {
    (client as any).telemetryClient = {
      ClientHeartbeat: (
        request: any,
        metadata: Metadata,
        options: any,
        callback: Function
      ) => {
        requests.push({ request, metadata, options });
        callback(null, { status: { error_code: 'Success' } });
      },
      close: jest.fn(),
    };
  }

  it('uses the grpc-js metadata overload for heartbeat unary calls', async () => {
    const client = new MilvusClient({
      address: 'localhost:19530',
      __SKIP_CONNECT__: true,
    });
    const requests: any[] = [];
    installHeartbeatCapture(client, requests);

    await (client.getTelemetry() as any).sendHeartbeat();

    expect(requests[0].metadata).toBeInstanceOf(Metadata);
    expect(requests[0].options.deadline).toBeInstanceOf(Date);
    await client.closeConnection();
  });

  it('omits an unset database but reports an explicitly selected default', async () => {
    const client = new MilvusClient({
      address: 'localhost:19530',
      __SKIP_CONNECT__: true,
    });
    const requests: any[] = [];
    installHeartbeatCapture(client, requests);

    await (client.getTelemetry() as any).sendHeartbeat();
    await client.useDatabase({ db_name: 'default' });
    await (client.getTelemetry() as any).sendHeartbeat();

    expect(requests[0].request.client_info.reserved).not.toHaveProperty(
      'db_name'
    );
    expect(requests[1].request.client_info.reserved.db_name).toBe('default');
    await client.closeConnection();
  });

  it('reports an explicitly configured default database', async () => {
    const client = new MilvusClient({
      address: 'localhost:19530',
      database: 'default',
      __SKIP_CONNECT__: true,
    });
    const requests: any[] = [];
    installHeartbeatCapture(client, requests);

    await (client.getTelemetry() as any).sendHeartbeat();

    expect(requests[0].request.client_info.reserved.db_name).toBe('default');
    await client.closeConnection();
  });
});
