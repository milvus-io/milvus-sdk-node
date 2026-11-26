import {
  Channel,
  ChannelOptions,
  ClientOptions,
  experimental,
  Metadata,
  compressionAlgorithms,
  status,
} from '@grpc/grpc-js';
import {
  CompressionFilter,
  CompressionFilterFactory,
} from '@grpc/grpc-js/build/src/compression-filter';
import {
  WriteFlags,
  WriteObject,
} from '@grpc/grpc-js/build/src/call-interface';
import { promisify } from 'util';
import * as zlib from 'zlib';

// The SDK supports Node 18 as well as releases that provide native zstd.
type ZstdCodec = (
  data: Buffer,
  options: { maxOutputLength?: number; params?: Record<number, number> },
  cb: (error: Error | null, result: Buffer) => void
) => void;
const native = zlib as typeof zlib & {
  zstdCompress?: ZstdCodec;
  zstdDecompress?: ZstdCodec;
};

const compress = native.zstdCompress && promisify(native.zstdCompress);
const decompress = native.zstdDecompress && promisify(native.zstdDecompress);

// Match the Proxy's 1 MiB encoder window and 8 MiB maximum decode window.
const constants = zlib.constants as typeof zlib.constants & {
  ZSTD_c_windowLog: number;
  ZSTD_d_windowLogMax: number;
};

type Peer = { serverSupportedEncodingHeader?: string };

// Internal filter for the SDK-owned channel.
export class ZstdFilter extends CompressionFilter {
  private receiveZstd = false;
  private readonly sendZstd: boolean;

  constructor(private readonly options: ChannelOptions, peer: Peer) {
    super(options, peer);
    const accepted = peer.serverSupportedEncodingHeader;
    this.sendZstd =
      !accepted || accepted.split(',').some(name => name.trim() === 'zstd');
  }

  async sendMetadata(input: Promise<Metadata>) {
    const metadata = await super.sendMetadata(input);
    metadata.set('grpc-accept-encoding', 'identity,deflate,gzip,zstd');
    if (this.sendZstd) metadata.set('grpc-encoding', 'zstd');
    return metadata;
  }

  receiveMetadata(metadata: Metadata) {
    this.receiveZstd = metadata.get('grpc-encoding')[0] === 'zstd';
    if (this.receiveZstd) metadata.remove('grpc-encoding');
    return super.receiveMetadata(metadata);
  }

  async sendMessage(input: Promise<WriteObject>): Promise<WriteObject> {
    const item = await input;
    if (
      !this.sendZstd ||
      !item.message.length ||
      (item.flags ?? 0) & WriteFlags.NoCompress
    ) {
      return super.sendMessage(Promise.resolve(item));
    }
    const limit = this.options['grpc.max_send_message_length'] ?? -1;
    if (limit >= 0 && item.message.length > limit) {
      throw {
        code: status.RESOURCE_EXHAUSTED,
        details: `Attempted to send message with a size larger than ${limit}`,
      };
    }
    const encoded = await compress!(item.message, {
      params: { [constants.ZSTD_c_windowLog]: 20 },
    });
    const frame = Buffer.allocUnsafe(5 + encoded.length);
    frame[0] = 1;
    frame.writeUInt32BE(encoded.length, 1);
    encoded.copy(frame, 5);
    return { ...item, message: frame };
  }

  async receiveMessage(input: Promise<Buffer>) {
    const frame = await input;
    if (!this.receiveZstd || frame[0] === 0) {
      return super.receiveMessage(Promise.resolve(frame));
    }
    const limit =
      this.options['grpc.max_receive_message_length'] ?? 4 * 1024 * 1024;
    let decoded: Buffer;
    try {
      decoded = await decompress!(frame.subarray(5), {
        params: { [constants.ZSTD_d_windowLogMax]: 23 },
        maxOutputLength: limit < 0 ? undefined : Math.max(1, limit),
      });
    } catch (error) {
      if (error.code !== 'ERR_BUFFER_TOO_LARGE') {
        throw {
          code: status.INTERNAL,
          details: 'Failed to decompress zstd-encoded message',
        };
      }
      throw {
        code: status.RESOURCE_EXHAUSTED,
        details: `Received message that decompresses to a size larger than ${limit}`,
      };
    }
    if (limit === 0 && decoded.length > 0) {
      throw {
        code: status.RESOURCE_EXHAUSTED,
        details: 'Received message that decompresses to a size larger than 0',
      };
    }
    return decoded;
  }
}

const createZstdChannel: NonNullable<
  ClientOptions['channelFactoryOverride']
> = (address, credentials, options) => {
  const channel = new Channel(address, credentials, options);
  // grpc-js has no public codec registration API. Its pinned version creates
  // the compression factory once per channel and clones this list per RPC.
  const { factories } = (
    channel as unknown as {
      internalChannel: {
        filterStackFactory: {
          factories: experimental.FilterFactory<experimental.Filter>[];
        };
      };
    }
  ).internalChannel.filterStackFactory;
  const index = factories.findIndex(
    factory => factory instanceof CompressionFilterFactory
  );
  if (index < 0) {
    channel.close();
    throw new Error('Unsupported grpc-js compression filter layout');
  }
  const peer: Peer = {};
  factories[index] = { createFilter: () => new ZstdFilter(options, peer) };
  return channel;
};

export function configureCompression(
  options: ChannelOptions,
  algorithm: 'identity' | 'gzip' | 'zstd'
) {
  if (algorithm === 'zstd') {
    if (!compress || !decompress) {
      throw new Error(
        'gRPC zstd compression requires Node.js 22.15+, 23.8+, or 24+'
      );
    }
    if (options.channelOverride || options.channelFactoryOverride) {
      throw new Error('gRPC zstd compression requires an SDK-created channel');
    }
    options.channelFactoryOverride = createZstdChannel;
    options['grpc.default_compression_algorithm'] =
      compressionAlgorithms.identity;
  } else if (algorithm === 'gzip' || algorithm === 'identity') {
    options['grpc.default_compression_algorithm'] =
      compressionAlgorithms[algorithm];
  } else {
    throw new Error(`Unsupported gRPC compression algorithm: ${algorithm}`);
  }
}
