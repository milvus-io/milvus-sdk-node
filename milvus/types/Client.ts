import { ChannelOptions } from '@grpc/grpc-js';

export interface GRPCClientConfig {
  address: string;
  ssl?: boolean;
  username?: string;
  password?: string;
  channelOptions?: ChannelOptions;
  timeout?: number | string;
}

export interface MilvusGrpcConfig {
  address: string;
  collection?: string;
  ssl?: boolean;
  username?: string;
  password?: string;
  timeout?: number | string;
  channelOptions?: ChannelOptions;
}

export interface MilvusHTTPConfig {
  address: string;
  collection: string;
}

export type MilvusClientConfig<T extends MilvusGrpcConfig | MilvusHTTPConfig> =
  T extends GRPCClientConfig ? GRPCClientConfig : MilvusHTTPConfig;
