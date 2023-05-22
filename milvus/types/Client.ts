import { ChannelOptions } from '@grpc/grpc-js';

/**
 * Configuration options for the Milvus client.
 */
export interface ClientConfig {
  // The address of the Milvus server.
  address: string;
  // token 
  token?: string;
  // Whether to use SSL encryption.
  ssl?: boolean;
  // The username to use for authentication.
  username?: string;
  // The password to use for authentication.
  password?: string;
  // Additional options to pass to the gRPC channel.
  channelOptions?: ChannelOptions;
  // The timeout for requests, in milliseconds.
  timeout?: number | string;
  // number of retries
  maxRetries?: number;
  // retry delay
  retryDelay?: number;
  // open debug logs
  debug?: boolean;
}
