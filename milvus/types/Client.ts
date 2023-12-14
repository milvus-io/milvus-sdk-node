import { ChannelOptions } from '@grpc/grpc-js';
import { Options } from 'generic-pool';

/**
 * Configuration options for the Milvus client.
 */
export interface ClientConfig {
  id?: string;
  // optional proto file paths
  // refer to https://github.com/milvus-io/milvus-proto
  protoFilePath?: {
    milvus?: string; // milvus.proto file path
    schema?: string; // schema.proto file path
  };
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
  // database
  database?: string;
  // log level
  logLevel?: string;

  tls?: {
    // root certificate file path, it can be a CA PEM (Certificate Authority PEM) or Server PEM (Server Certificate PEM):
    rootCertPath?: string;
    // private key path
    privateKeyPath?: string;
    // certificate path
    certChainPath?: string;
    // verify options
    verifyOptions?: Record<string, any>;
    // server name
    serverName?: string;
  };

  // generic-pool options: refer to https://github.com/coopernurse/node-pool
  pool?: Options;

  // internal property for debug & test
  __SKIP_CONNECT__?: boolean;
}

export interface ServerInfo {
  build_tags?: string;
  build_time?: string;
  git_commit?: string;
  go_version?: string;
  deploy_mode?: string;
  reserved?: { [key: string]: any };
}
