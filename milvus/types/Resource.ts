import {
  GrpcTimeOut,
  resStatusResponse,
  ResStatus,
  collectionNameReq,
  KeyValuePair,
} from './Common';

type ResourceGroupConfig = {
  requests?: { node_num: number }; // requests node num in resource group, if node num is less than requests.nodeNum, it will be transfer from other resource group.
  limits?: { node_num: number }; // limited node num in resource group, if node num is more than limits.nodeNum, it will be transfer to other resource group.
  transfer_from?: { resource_group: string }[]; // missing node should be transfer from given resource group at high priority in repeated list.
  transfer_to?: { resource_group: string }[]; // redundant node should be transfer to given resource group at high priority in repeated list.
  node_filter?: { node_labels: KeyValuePair[] }; // node in resource group must match node filters
};

type NodeInfo = {
  node_id: number;
  address: string;
  hostname: string;
};

type ResourceGroup = {
  name: string;
  capacity: number;
  num_available_node: number;
  num_loaded_replica: { [key: string]: number };
  num_outgoing_node: { [key: string]: number };
  num_incoming_node: { [key: string]: number };
  config?: ResourceGroupConfig;
  nodes?: NodeInfo[];
};

interface BaseResourceGroupReq extends GrpcTimeOut {
  resource_group: string;
}

export interface CreateResourceGroupReq extends BaseResourceGroupReq {
  config?: ResourceGroupConfig;
}
export interface DescribeResourceGroupsReq extends BaseResourceGroupReq {}
export interface UpdateRresourceGroupReq extends GrpcTimeOut {
  resource_groups: { [key: string]: ResourceGroupConfig };
}
export interface DropResourceGroupsReq extends BaseResourceGroupReq {}

export interface TransferNodeReq extends GrpcTimeOut {
  source_resource_group: string; // required, source resource group
  target_resource_group: string; // required, target resource group
  num_node: number; // required, number of nodes
}

export interface TransferReplicaReq extends collectionNameReq {
  source_resource_group: string; // required, source resource group
  target_resource_group: string; // required, target resource group
  num_replica: number; // required, number of replica
}

export interface ListResourceGroupsResponse extends resStatusResponse {
  resource_groups: string[]; // resource groups
}

export interface DescribeResourceGroupResponse extends resStatusResponse {
  resource_group: ResourceGroup;
}

export interface ReplicateConnectionParam {
  uri: string;
  token?: string;
}

export interface ReplicateCluster {
  cluster_id: string;
  connection_param: ReplicateConnectionParam;
  pchannels?: string[];
}

export interface CrossClusterTopology {
  source_cluster_id: string;
  target_cluster_id: string;
}

export interface ReplicateConfiguration {
  clusters: ReplicateCluster[];
  cross_cluster_topology?: CrossClusterTopology[];
}

export interface UpdateReplicateConfigurationReq extends GrpcTimeOut {
  clusters: ReplicateCluster[];
  cross_cluster_topology?: CrossClusterTopology[];
  force_promote?: boolean;
}

export interface GetReplicateConfigurationReq extends GrpcTimeOut {}

export interface GetReplicateConfigurationResponse extends resStatusResponse {
  configuration: ReplicateConfiguration;
}

export interface ReplicateMessageId {
  id: string;
  WAL_name: 'Unknown' | 'RocksMQ' | 'Pulsar' | 'Kafka' | 'WoodPecker' | 'Test';
}

export interface ReplicateCheckpoint {
  cluster_id: string;
  pchannel: string;
  message_id: ReplicateMessageId | null;
  /** Source time tick, returned as a decimal string by default. */
  time_tick: string;
}

export interface GetReplicateInfoReq extends GrpcTimeOut {
  target_pchannel: string;
  source_cluster_id?: string;
}

export interface GetReplicateInfoResponse {
  checkpoint: ReplicateCheckpoint | null;
  salvage_checkpoint: ReplicateCheckpoint | null;
}

export interface ImmutableReplicateMessage {
  id: ReplicateMessageId | null;
  payload: Buffer;
  properties: Record<string, string>;
}

export interface CreateReplicateStreamReq extends GrpcTimeOut {
  /** The target cluster ID forwarded in gRPC metadata. */
  cluster_id: string;
}

export interface ReplicateStreamRequest {
  replicate_message: {
    source_cluster_id: string;
    message: ImmutableReplicateMessage;
  };
}

export interface ReplicateStreamResponse {
  response: 'replicate_confirmed_message_info';
  replicate_confirmed_message_info: {
    confirmed_time_tick: string;
  };
}

export interface DumpMessagesReq extends GrpcTimeOut {
  pchannel: string;
  start_message_id: ReplicateMessageId;
  start_timetick?: string | number;
  end_timetick?: string | number;
  include_start_message?: boolean;
}

export type DumpMessagesResponse =
  | { response: 'message'; message: ImmutableReplicateMessage }
  | { response: 'status'; status: ResStatus };
