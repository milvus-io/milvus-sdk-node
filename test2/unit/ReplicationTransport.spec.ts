import { once } from 'events';
import {
  Client,
  sendUnaryData,
  Server,
  ServerCredentials,
  ServerDuplexStream,
  ServerUnaryCall,
  ServerWritableStream,
  status,
} from '@grpc/grpc-js';
import {
  DumpMessagesReq,
  DumpMessagesResponse,
  GetReplicateInfoReq,
  GetReplicateInfoResponse,
  ReplicateStreamRequest,
  ReplicateStreamResponse,
  MilvusClient,
  LOADER_OPTIONS,
  getGRPCService,
} from '../../milvus';

const Service = getGRPCService(
  { serviceName: 'milvus.proto.milvus.MilvusService' },
  LOADER_OPTIONS
);
const messageId = { id: 'start', WAL_name: 'RocksMQ' } as const;
const message = {
  id: messageId,
  payload: Buffer.from([0, 255, 5]),
  properties: { marker: 'message' },
};
const timeTick = '9223372036854775808';
const dumpRequest = {
  pchannel: 'physical_0',
  start_message_id: messageId,
  end_timetick: timeTick,
  include_start_message: true,
};
const checkpoint = {
  pchannel: dumpRequest.pchannel,
  cluster_id: 'source',
  message_id: messageId,
  time_tick: timeTick,
};
const ack: ReplicateStreamResponse = {
  response: 'replicate_confirmed_message_info',
  replicate_confirmed_message_info: { confirmed_time_tick: timeTick },
};
const dumpCalls = jest.fn();
const duplexCalls = jest.fn();
const server = new Server();
let client: MilvusClient;

beforeAll(async () => {
  server.addService(Service.service, {
    GetReplicateInfo(
      call: ServerUnaryCall<GetReplicateInfoReq, GetReplicateInfoResponse>,
      callback: sendUnaryData<GetReplicateInfoResponse>
    ) {
      callback(null, {
        checkpoint: {
          ...checkpoint,
          pchannel: call.request.target_pchannel,
          cluster_id: call.request.source_cluster_id!,
        },
        salvage_checkpoint: null,
      });
    },
    CreateReplicateStream(
      call: ServerDuplexStream<ReplicateStreamRequest, ReplicateStreamResponse>
    ) {
      call.on('data', request => {
        duplexCalls(
          request,
          call.metadata.get('cluster-id'),
          call.metadata.get('authorization')
        );
        call.write(ack);
        call.write(ack);
      });
      call.on('end', () => call.end());
    },
    DumpMessages(
      call: ServerWritableStream<DumpMessagesReq, DumpMessagesResponse>
    ) {
      dumpCalls(call.request, call.metadata.get('client-request-id'));
      if (call.request.pchannel === 'failure') {
        call.emit('error', {
          code: status.UNAVAILABLE,
          details: 'server stopped',
        });
        return;
      }
      if (call.request.pchannel === 'open') {
        return;
      }
      call.write({ response: 'message', message });
      call.write({ response: 'message', message });
      call.end();
    },
  });
  const port = await new Promise<number>((resolve, reject) => {
    server.bindAsync(
      '127.0.0.1:0',
      ServerCredentials.createInsecure(),
      (error, boundPort) => (error ? reject(error) : resolve(boundPort))
    );
  });
  client = new MilvusClient({
    address: `127.0.0.1:${port}`,
    token: 'test:token',
    __SKIP_CONNECT__: true,
  });
});

afterAll(async () => {
  await client?.closeConnection();
  server.forceShutdown();
});

it('preserves checkpoint values and absent salvage checkpoints', async () => {
  await expect(
    client.getReplicateInfo({
      target_pchannel: checkpoint.pchannel,
      source_cluster_id: checkpoint.cluster_id,
    })
  ).resolves.toEqual({ checkpoint, salvage_checkpoint: null });
});

it('sends all duplex messages and receives each acknowledgement', async () => {
  const source = {
    replicate_message: { source_cluster_id: 'source', message },
  };
  const stream = await client.createReplicateStream({ cluster_id: 'target' });
  stream.write(source);
  stream.end(source);
  const replies = [];
  for await (const reply of stream) {
    replies.push(reply);
  }
  expect(duplexCalls).toHaveBeenCalledTimes(2);
  expect(duplexCalls).toHaveBeenCalledWith(
    expect.objectContaining(source),
    ['target'],
    [Buffer.from('test:token').toString('base64')]
  );
  expect(replies).toEqual([ack, ack, ack, ack]);
});

it('preserves the unsigned time range, binary payloads, and request metadata', async () => {
  const stream = await client.dumpMessages({
    ...dumpRequest,
    client_request_id: 'wal-salvage',
  });
  const replies = [];
  for await (const reply of stream) {
    replies.push(reply);
  }
  expect(dumpCalls).toHaveBeenLastCalledWith(
    expect.objectContaining(dumpRequest),
    ['wal-salvage']
  );
  expect(replies).toEqual([
    { response: 'message', message },
    { response: 'message', message },
  ]);
});

it('surfaces terminal errors without replaying the failed stream', async () => {
  const previousCalls = dumpCalls.mock.calls.length;
  const stream = await client.dumpMessages({
    ...dumpRequest,
    pchannel: 'failure',
  });
  await expect(once(stream, 'status')).rejects.toMatchObject({
    code: status.UNAVAILABLE,
  });
  expect(dumpCalls).toHaveBeenCalledTimes(previousCalls + 1);
});

it('closes a channel if starting a replication stream throws', async () => {
  const close = jest.spyOn(Client.prototype, 'close');
  try {
    await expect(
      client.createReplicateStream({ cluster_id: 'non-ascii-集群' })
    ).rejects.toThrow('illegal characters');
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    close.mockRestore();
  }
});

it('cancels an active stream when the SDK closes', async () => {
  const stream = await client.dumpMessages({
    ...dumpRequest,
    pchannel: 'open',
    timeout: 0,
  });
  const terminated = expect(once(stream, 'status')).rejects.toMatchObject({
    code: status.CANCELLED,
  });
  await client.closeConnection();
  await terminated;
  await expect(
    client.createReplicateStream({ cluster_id: 'target' })
  ).rejects.toThrow('client is closed');
});
