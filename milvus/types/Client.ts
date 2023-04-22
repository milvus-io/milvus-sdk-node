import { ChannelOptions } from '@grpc/grpc-js';

export interface MilvusClientConfig {
  address: string;
  ssl?: boolean;
  username?: string;
  password?: string;
  channelOptions?: ChannelOptions;
}
