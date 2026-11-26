import {
  ChannelOptions,
  compressionAlgorithms,
  credentials,
  Metadata,
  status,
} from '@grpc/grpc-js';
import { WriteFlags } from '@grpc/grpc-js/build/src/call-interface';
import * as zlib from 'zlib';
import {
  configureCompression,
  ZstdFilter,
} from '../../milvus/grpc/ZstdChannel';

const native = zlib as typeof zlib & {
  zstdCompressSync?: (message: Buffer) => Buffer;
  zstdDecompressSync?: (
    message: Buffer,
    options: { params: Record<number, number> }
  ) => Buffer;
};
const withZstd = native.zstdCompressSync ? it : it.skip;
const message = Buffer.from('hello from Milvus');

function responseFrame(bytes: Buffer, compressed: boolean) {
  const prefix = Buffer.alloc(5);
  prefix[0] = Number(compressed);
  prefix.writeUInt32BE(bytes.length, 1);
  return Promise.resolve(Buffer.concat([prefix, bytes]));
}

describe('zstd gRPC filter', () => {
  withZstd(
    'uses the codec advertised by the peer and honors NO_COMPRESS on an individual message',
    async () => {
      const peer = { serverSupportedEncodingHeader: 'identity, gzip, zstd' };
      const enabled = new ZstdFilter({}, peer);
      expect(
        (await enabled.sendMetadata(Promise.resolve(new Metadata()))).get(
          'grpc-encoding'
        )
      ).toEqual(['zstd']);
      expect(
        (
          await enabled.sendMessage(
            Promise.resolve({ message, flags: WriteFlags.NoCompress })
          )
        ).message
      ).toEqual(await responseFrame(message, false));

      const received = new Metadata();
      received.set('grpc-accept-encoding', 'identity, gzip');
      enabled.receiveMetadata(received);
      const next = new ZstdFilter({}, peer);
      expect(
        (await next.sendMetadata(Promise.resolve(new Metadata()))).get(
          'grpc-encoding'
        )
      ).toEqual([]);
      expect(
        (await next.sendMessage(Promise.resolve({ message }))).message
      ).toEqual(await responseFrame(message, false));
      expect(await next.receiveMessage(responseFrame(message, false))).toEqual(
        message
      );
    }
  );

  withZstd(
    'bounds the encoder window and checks logical size before encoding',
    async () => {
      const input = Buffer.alloc(3 * 1024 * 1024, 0x61);
      const filter = new ZstdFilter({}, {});
      const frame = (
        await filter.sendMessage(Promise.resolve({ message: input }))
      ).message;
      expect(frame[0]).toBe(1);
      const { ZSTD_d_windowLogMax } =
        zlib.constants as typeof zlib.constants & {
          ZSTD_d_windowLogMax: number;
        };
      const restored = native.zstdDecompressSync!(frame.subarray(5), {
        params: { [ZSTD_d_windowLogMax]: 20 },
      });
      expect(restored.equals(input)).toBe(true);
      const bounded = new ZstdFilter(
        { 'grpc.max_send_message_length': message.length - 1 },
        {}
      );
      await expect(
        bounded.sendMessage(Promise.resolve({ message }))
      ).rejects.toMatchObject({ code: status.RESOURCE_EXHAUSTED });
    }
  );

  withZstd(
    'distinguishes a plain frame, an incorrectly labeled frame, and a zero-length decoded limit',
    async () => {
      const metadata = () => {
        const m = new Metadata();
        m.set('grpc-encoding', 'zstd');
        return m;
      };
      const filter = new ZstdFilter({}, {});
      filter.receiveMetadata(metadata());
      expect(
        await filter.receiveMessage(responseFrame(message, false))
      ).toEqual(message);
      await expect(
        filter.receiveMessage(responseFrame(zlib.gzipSync(message), true))
      ).rejects.toMatchObject({ code: status.INTERNAL });
      const zero = new ZstdFilter({ 'grpc.max_receive_message_length': 0 }, {});
      zero.receiveMetadata(metadata());
      await expect(
        zero.receiveMessage(
          responseFrame(native.zstdCompressSync!(Buffer.from('x')), true)
        )
      ).rejects.toMatchObject({ code: status.RESOURCE_EXHAUSTED });
    }
  );
});

describe('gRPC compression configuration', () => {
  it('accepts explicit identity and rejects unsupported configuration values', () => {
    const options: ChannelOptions = {};
    configureCompression(options, 'identity');
    expect(options['grpc.default_compression_algorithm']).toBe(
      compressionAlgorithms.identity
    );
    expect(() => configureCompression({}, 'br' as never)).toThrow(
      'Unsupported gRPC compression algorithm: br'
    );
  });

  withZstd(
    'reports conflicts with a caller-supplied channel or channel factory',
    () => {
      for (const options of [
        { channelOverride: {} },
        { channelFactoryOverride: jest.fn() },
      ]) {
        expect(() => configureCompression(options, 'zstd')).toThrow(
          'requires an SDK-created channel'
        );
      }
    }
  );

  it('explains the runtime requirement when native zstd is absent', () => {
    try {
      jest.isolateModules(() => {
        jest.doMock('zlib', () => ({
          ...jest.requireActual('zlib'),
          zstdCompress: undefined,
          zstdDecompress: undefined,
        }));
        const {
          configureCompression,
        } = require('../../milvus/grpc/ZstdChannel');
        expect(() => configureCompression({}, 'zstd')).toThrow(
          'requires Node.js'
        );
      });
    } finally {
      jest.dontMock('zlib');
    }
  });

  withZstd(
    'closes the new channel when the installed transport has an incompatible filter layout',
    () => {
      const close = jest.fn();
      try {
        jest.isolateModules(() => {
          jest.doMock('@grpc/grpc-js', () => ({
            ...jest.requireActual('@grpc/grpc-js'),
            Channel: class {
              internalChannel = { filterStackFactory: { factories: [] } };
              close = close;
            },
          }));
          const {
            configureCompression,
          } = require('../../milvus/grpc/ZstdChannel');
          const options: ChannelOptions = {};
          configureCompression(options, 'zstd');
          expect(() =>
            options.channelFactoryOverride(
              'localhost:0',
              credentials.createInsecure(),
              {}
            )
          ).toThrow('Unsupported grpc-js compression filter layout');
        });
      } finally {
        jest.dontMock('@grpc/grpc-js');
      }
      expect(close).toHaveBeenCalledTimes(1);
    }
  );
});
