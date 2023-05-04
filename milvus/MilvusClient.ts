import { GRPCClient, ClientConfig } from '.';
import { ChannelOptions } from '@grpc/grpc-js';

export class MilvusClient extends GRPCClient {
  constructor(
    configOrAddress: ClientConfig | string,
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
