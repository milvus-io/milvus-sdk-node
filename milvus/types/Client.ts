import { ChannelOptions } from '@grpc/grpc-js';

export interface GRPCClientConfig {
  address: string;
  ssl?: boolean;
  username?: string;
  password?: string;
  channelOptions?: ChannelOptions;
  timeout?: number | string;
}
