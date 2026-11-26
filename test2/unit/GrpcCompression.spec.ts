import { createServer, ServerHttp2Stream } from 'http2';
import { AddressInfo } from 'net';
import * as zlib from 'zlib';
import { getGRPCService, LOADER_OPTIONS, MilvusClient } from '../../milvus';

const service = getGRPCService(
  { serviceName: 'milvus.proto.milvus.MilvusService' },
  LOADER_OPTIONS
).service;

const native = zlib as typeof zlib & {
  zstdCompressSync?: (input: Buffer) => Buffer;
  zstdDecompressSync?: (input: Buffer) => Buffer;
};
const version = 'milvus-' + 'abc'.repeat(300);
const withZstd = native.zstdCompressSync ? it : it.skip;

function finish(stream: ServerHttp2Stream, encoding: string, message: Buffer) {
  const compressed =
    encoding === 'zstd'
      ? native.zstdCompressSync!(message)
      : encoding === 'gzip'
      ? zlib.gzipSync(message)
      : message;
  const prefix = Buffer.alloc(5);
  prefix[0] = encoding === 'identity' ? 0 : 1;
  prefix.writeUInt32BE(compressed.length, 1);
  stream.respond(
    {
      ':status': 200,
      'content-type': 'application/grpc',
      'grpc-encoding': encoding,
    },
    { waitForTrailers: true }
  );
  stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0' }));
  stream.end(Buffer.concat([prefix, compressed]));
}

describe('gRPC message compression', () => {
  const server = createServer();
  const received: {
    method: string;
    encoding: string;
    flag: number;
    accept: string;
    user?: string;
  }[] = [];
  let address: string;
  let rejectCodec = false;

  beforeAll(async () => {
    server.on('stream', (stream, headers) => {
      const chunks: Buffer[] = [];
      stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
      stream.on('end', () => {
        if (rejectCodec) {
          stream.respond(
            {
              ':status': 200,
              'content-type': 'application/grpc',
              'grpc-status': '12',
              'grpc-message':
                'grpc: Decompressor is not installed for grpc-encoding zstd',
            },
            { endStream: true }
          );
          return;
        }
        const framed = Buffer.concat(chunks);
        const method = headers[':path']!.split('/').pop()!;
        const encoding = String(headers['grpc-encoding'] || 'identity');
        const data = framed.subarray(5);
        const payload =
          framed[0] === 0
            ? data
            : encoding === 'gzip'
            ? zlib.gunzipSync(data)
            : native.zstdDecompressSync!(data);
        const req = service[method].requestDeserialize(payload);
        received.push({
          method,
          encoding,
          flag: framed[0],
          accept: String(headers['grpc-accept-encoding']),
          user: req.client_info?.user,
        });
        const resp =
          method === 'Connect'
            ? { identifier: '42', server_info: {} }
            : { version };
        finish(stream, encoding, service[method].responseSerialize(resp));
      });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    address = '127.0.0.1:' + (server.address() as AddressInfo).port;
  });
  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it.each([undefined, 'gzip'] as const)(
    'preserves ordinary client behavior for %s',
    async grpcCompression => {
      const client = new MilvusClient({
        address,
        grpcCompression,
        username: 'client',
        telemetry: { enabled: false },
      });
      try {
        expect((await client.getVersion()).version).toEqual(version);
        expect(received).toContainEqual(
          expect.objectContaining({
            method: 'Connect',
            encoding: grpcCompression ?? 'identity',
            flag: grpcCompression ? 1 : 0,
            user: 'client',
          })
        );
      } finally {
        await client.closeConnection();
      }
    }
  );

  if (!native.zstdCompressSync) {
    it('reports the Node runtime requirement at construction', () => {
      expect(
        () => new MilvusClient({ address, grpcCompression: 'zstd' })
      ).toThrow(/requires Node.js/);
    });
  }

  withZstd(
    'compresses both directions and isolates clients sharing an endpoint',
    async () => {
      const client = new MilvusClient({
        address,
        grpcCompression: 'zstd',
        username: 'zstd-client',
        telemetry: { enabled: false },
      });
      const plain = new MilvusClient({
        address,
        username: 'plain-client',
        telemetry: { enabled: false },
      });
      try {
        const results = await Promise.all([
          client.getVersion(),
          plain.getVersion(),
        ]);
        expect(results.map(result => result.version)).toEqual([
          version,
          version,
        ]);
        expect(received).toContainEqual(
          expect.objectContaining({
            method: 'Connect',
            encoding: 'zstd',
            flag: 1,
            user: 'zstd-client',
            accept: expect.stringContaining('zstd'),
          })
        );
        expect(received).toContainEqual(
          expect.objectContaining({
            method: 'Connect',
            encoding: 'identity',
            flag: 0,
            user: 'plain-client',
            accept: expect.not.stringContaining('zstd'),
          })
        );
      } finally {
        await Promise.all([client.closeConnection(), plain.closeConnection()]);
      }
    }
  );

  withZstd('enforces the decoded response size limit', async () => {
    const client = new MilvusClient({
      address,
      grpcCompression: 'zstd',
      channelOptions: { 'grpc.max_receive_message_length': 256 },
      maxRetries: 0,
      telemetry: { enabled: false },
    });
    try {
      await expect(client.getVersion()).rejects.toMatchObject({ code: 8 });
    } finally {
      await client.closeConnection();
    }
  });

  withZstd('surfaces an unsupported codec from the server', async () => {
    rejectCodec = true;
    const client = new MilvusClient({
      address,
      grpcCompression: 'zstd',
      maxRetries: 0,
      telemetry: { enabled: false },
    });
    try {
      await expect(client.connectPromise).rejects.toMatchObject({ code: 12 });
    } finally {
      rejectCodec = false;
      await client.closeConnection();
    }
  });
});
