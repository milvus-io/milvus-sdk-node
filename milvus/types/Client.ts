import { ChannelOptions } from '@grpc/grpc-js';
import { Options as LoaderOption } from '@grpc/proto-loader';
import { Options } from 'generic-pool';
import { GrpcTimeOut, KeyValuePair, ResStatus } from './Common';
import type { TelemetryConfig, TelemetryMetric } from '../telemetry';

/**
 * Configuration options for the Milvus client.
 */
export interface ClientConfig {
  id?: string;
  // The address of the Milvus server.
  address: string;
  // token
  // Accepts either `username:password` or `apikey` from Zilliz Cloud if you don't want to use `username` and `password` fields or you are using Zilliz Cloud serverless option
  token?: string;
  // Whether to use SSL encryption.
  ssl?: boolean;
  // The username to use for authentication.
  username?: string;
  // The password to use for authentication.
  password?: string;
  // Additional options to pass to the gRPC channel.
  channelOptions?: ChannelOptions;
  /** Outgoing gRPC message encoding. Defaults to identity. Zstd requires a Node runtime with native zstd. */
  grpcCompression?: 'identity' | 'gzip' | 'zstd';
  // Reserved connection options sent in ConnectRequest client info.
  option?: Record<string, string>;
  // The timeout for requests, in milliseconds.
  timeout?: number | string;
  // number of retries
  maxRetries?: number;
  // retry delay
  retryDelay?: number;
  // database name
  database?: string;
  // log level
  logLevel?: string;
  // log prefix
  logPrefix?: string;

  tls?: {
    // root certificate file path, it can be a CA PEM (Certificate Authority PEM) or Server PEM (Server Certificate PEM):
    rootCertPath?: string;
    // root certificate buffer
    rootCert?: Buffer;
    // private key path
    privateKeyPath?: string;
    // private key buffer
    privateKey?: Buffer;
    // certificate path
    certChainPath?: string;
    // certificate buffer
    certChain?: Buffer;
    // verify options
    verifyOptions?: Record<string, any>;
    // server name
    serverName?: string;
    // skip certificate check entirely
    skipCertCheck?: boolean;
  };

  // generic-pool options: refer to https://github.com/coopernurse/node-pool
  pool?: Options;

  // internal property for debug & test
  __SKIP_CONNECT__?: boolean;

  // loaderOptions : { longs: Function | Number | String },
  // Function converts int64 to Long.js format
  // Number converts int64 to number, it will lose precision
  // String converts int64 to string, it's the default behavior
  loaderOptions?: LoaderOption;

  // enable trace
  trace?: boolean;

  // Client metrics, heartbeat, and server-pushed command configuration.
  telemetry?: TelemetryConfig;

  // Explicitly enable/disable global cluster mode.
  // When true, the SDK fetches topology from the endpoint and routes to the primary cluster.
  // When omitted, auto-detected from the address URI (looks for 'global-cluster').
  isGlobal?: boolean;
}

export interface ServerInfo {
  build_tags?: string;
  build_time?: string;
  git_commit?: string;
  go_version?: string;
  deploy_mode?: string;
  reserved?: { [key: string]: any };
}

export interface AllocTimestampResponse {
  status: ResStatus;
  /** Milvus hybrid timestamp, returned as a decimal string by default. */
  timestamp: string;
}

export interface MilvusComponentInfo {
  nodeID: string;
  role: string;
  state_code: 'Initializing' | 'Healthy' | 'Abnormal' | 'StandBy' | 'Stopping';
  extra_info: KeyValuePair<string, string>[];
}

export interface GetComponentStatesResponse {
  status: ResStatus;
  state: MilvusComponentInfo | null;
  subcomponent_states: MilvusComponentInfo[];
}

export interface RegisterLinkResponse {
  status: ResStatus;
  address: { ip: string; port: string } | null;
}

export interface DummyReq extends GrpcTimeOut {
  /** JSON diagnostic query accepted by Milvus's legacy Dummy RPC. */
  request_type: string;
}

export interface DummyResponse {
  /** JSON string reporting the diagnostic result. */
  response: string;
}

export interface GetClientTelemetryReq extends GrpcTimeOut {
  database?: string;
  client_id?: string;
  include_metrics?: boolean;
}

type TelemetryCounter = 'request_count' | 'success_count' | 'error_count';

/** Metrics returned by the gRPC loader, with exact int64 counters. */
export interface ClientTelemetryMetrics
  extends Omit<TelemetryMetric, TelemetryCounter> {
  request_count: string;
  success_count: string;
  error_count: string;
}

export interface ClientTelemetryInfo {
  client_info: {
    sdk_type: string;
    sdk_version: string;
    local_time: string;
    user: string;
    host: string;
    reserved: Record<string, string>;
  } | null;
  last_heartbeat_time: string;
  status: string;
  databases: string[];
  metrics: {
    operation: string;
    global: ClientTelemetryMetrics | null;
    collection_metrics: Record<string, ClientTelemetryMetrics>;
  }[];
}

export interface GetClientTelemetryResponse {
  status: ResStatus;
  clients: ClientTelemetryInfo[];
  aggregated: ClientTelemetryMetrics | null;
}

export interface PushClientCommandReq extends GrpcTimeOut {
  command_type: string;
  /** Command payload as bytes or a base64 string. */
  payload?: Uint8Array | string;
  target_client_id?: string;
  target_database?: string;
  ttl_seconds?: number | string;
  persistent?: boolean;
}

export interface PushClientCommandResponse {
  status: ResStatus;
  command_id: string;
}

export interface DeleteClientCommandReq extends GrpcTimeOut {
  command_id: string;
}

export interface DeleteClientCommandResponse {
  status: ResStatus;
}

export interface RunAnalyzerRequest {
  analyzer_params?: Record<string, any>;
  text: string | string[];
  with_detail?: boolean;
  with_hash?: boolean;
  db_name?: string;
  collection_name?: string;
  field_name?: string;
  analyzer_names?: string[];
}

type AnalyzerToken = {
  token: string;
  start_offset: number;
  end_offset: number;
  position: number;
  position_length: number;
  hash: number;
};
export type AnalyzerResult = {
  tokens: AnalyzerToken[];
};

export interface RunAnalyzerResponse {
  status: ResStatus;
  results: AnalyzerResult[];
}

export interface ComputePhraseMatchSlopReq extends GrpcTimeOut {
  /** Analyzer settings. An empty object uses the server's default analyzer. */
  analyzer_params?: RunAnalyzerRequest['analyzer_params'];
  query_text: string;
  data_texts: string[];
}

export interface ComputePhraseMatchSlopResponse {
  status: ResStatus;
  is_match: boolean[];
  /** Minimum slop for each input as a decimal string, or '-1' for no match. */
  slops: string[];
}

export interface AddFileResourceReq extends GrpcTimeOut {
  name: string;
  path: string;
}

export interface RemoveFileResourceReq extends GrpcTimeOut {
  name: string;
}

export interface ListFileResourcesReq extends GrpcTimeOut {}

export interface FileResourceInfo {
  id: string;
  name: string;
  path: string;
}

export interface ListFileResourcesResponse {
  status: ResStatus;
  resources: FileResourceInfo[];
}
