import { GrpcClient, GRPCClientConfig } from '.';
import { ChannelOptions } from '@grpc/grpc-js';

export class MilvusClient extends GrpcClient {
  constructor(
    configOrAddress: GRPCClientConfig | string,
    ssl?: boolean,
    username?: string,
    password?: string,
    channelOptions?: ChannelOptions
  ) {
    super(configOrAddress, ssl, username, password, channelOptions);

    // connect
    this.connect();
  }

  // overload
  connect() {
    super.connect();
  }
}
