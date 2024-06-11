import { GrpcTimeOut, resStatusResponse, collectionNameReq } from './Common';

type ResourceGroupConfig = {
  requests?: { node_num: number }; // requests node num in resource group, if node num is less than requests.nodeNum, it will be transfer from other resource group.
  limits?: { node_num: number }; // limited node num in resource group, if node num is more than limits.nodeNum, it will be transfer to other resource group.
  transfer_from?: { resource_group: string }[]; // missing node should be transfer from given resource group at high priority in repeated list.
  transfer_to?: { resource_group: string }[]; // redundant node should be transfer to given resource group at high priority in repeated list.
};

type ResourceGroup = {
  name: string;
  capacity: number;
  num_available_node: number;
  num_loaded_replica: { [key: string]: number };
  num_outgoing_node: { [key: string]: number };
  num_incoming_node: { [key: string]: number };
  config?: ResourceGroupConfig;
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
