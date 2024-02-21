import { GrpcTimeOut, resStatusResponse } from './Common';

export interface CreateResourceGroupReq extends GrpcTimeOut {
  resource_group: string;
}
export interface DropResourceGroupsReq extends CreateResourceGroupReq {}
export interface DescribeResourceGroupsReq extends CreateResourceGroupReq {}

export interface TransferNodeReq extends GrpcTimeOut {
  source_resource_group: string; // required, source resource group
  target_resource_group: string; // required, target resource group
  num_node: number; // required, number of nodes
}

export interface TransferReplicaReq extends GrpcTimeOut {
  source_resource_group: string; // required, source resource group
  target_resource_group: string; // required, target resource group
  collection_name: string; // required, collection name
  num_replica: number; // required, number of replica
}

export interface ListResourceGroupsResponse extends resStatusResponse {
  resource_groups: string[]; // resource groups
}

type ResourceGroup = {
  name: string;
  capacity: number;
  num_available_node: number;
  num_loaded_replica: { [key: string]: number };
  num_outgoing_node: { [key: string]: number };
  num_incoming_node: { [key: string]: number };
};

export interface DescribeResourceGroupResponse extends resStatusResponse {
  resource_group: ResourceGroup;
}
