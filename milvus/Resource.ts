import { promisify } from '../utils';
import { Client } from './Client';
import { ResStatus } from './types';
import { DEFAULT_RESOURCE_GROUP } from './const/Milvus';
import {
  GrpcTimeOut,
  CreateResourceGroupReq,
  DropResourceGroupsReq,
  ListResourceGroupsResponse,
  DesribeResourceGroupsReq,
  DescribeResourceGroupResponse,
  TransferNodeReq,
  TransferReplicaReq,
} from './types';

export class Resource extends Client {
  /**
   * Create a resource group.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :--  | :-- |
   *  | resource_group | String | Resource group name |
   *  | timeout | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @return
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | status.error_code | string | error code |
   *  | status.reason | string | error reason |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).resourceManager.createResourceGroup({
   *     resource_group: "vector_01",
   *  });
   * ```
   */
  async createResourceGroup(data: CreateResourceGroupReq): Promise<ResStatus> {
    const promise = await promisify(
      this.client,
      'CreateResourceGroup',
      data,
      data.timeout
    );
    return promise;
  }

  /**
   * list resource groups.
   *
   * @return
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | status.error_code | string | error code |
   *  | status.reason | string | error reason |
   *  | resource_groups | string[] | Resource group string array |
   *  | timeout | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).resourceManager.listResourceGroups();
   * ```
   */
  async listResourceGroups(
    data?: GrpcTimeOut
  ): Promise<ListResourceGroupsResponse> {
    const promise = await promisify(
      this.client,
      'ListResourceGroups',
      {},
      data?.timeout
    );
    return promise;
  }

  /**
   * Describe a resource group.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :--  | :-- |
   *  | resource_group | String | Resource group name |
   *  | timeout | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @return
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | status.error_code | string | error code |
   *  | status.reason | string | error reason |
   *  | resource_group.capacity | number | num_node which has been transfer to this rg |
   *  | resource_group.num_available_node | number | available node_num, some node may shutdown |
   *  | resource_group.num_loaded_replica | { [key: string]: number } | from collection_name to loaded replica of each collecion in this rg |
   *  | resource_group.num_outgoing_node | { [key: string]: number } | from collection_name to outgoging accessed node num by replica loaded in this rg |
   *  | resource_group.num_incoming_node | { [key: string]: number } | from collection_name to incoming accessed node num by replica loaded in other rg |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).resourceManager.describeResrouceGroup({
   *    resource_group: 'my-resource-group'
   * });
   * ```
   */
  async describeResourceGroup(
    data: DesribeResourceGroupsReq
  ): Promise<DescribeResourceGroupResponse> {
    const promise = await promisify(
      this.client,
      'DescribeResourceGroup',
      data,
      data.timeout
    );
    return promise;
  }

  /**
   * drop a resource group.
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :--  | :-- |
   *  | resource_group | String | Resource group name |
   *  | timeout | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @return
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | status.error_code | string | error code |
   *  | status.reason | string | error reason |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).resourceManager.dropResourceGroup({
   *    resource_group: 'my-resource-group'
   * });
   * ```
   */
  async dropResourceGroup(data: DropResourceGroupsReq): Promise<ResStatus> {
    const promise = await promisify(
      this.client,
      'DropResourceGroup',
      data,
      data.timeout
    );
    return promise;
  }

  /**
   * transfer nodes from one resource group to another
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :--  | :-- |
   *  | source_resource_group | String | source resource group name |
   *  | target_resource_group | String | target resource group name |
   *  | collection_name | String | collection name |
   *  | num_replica | Number | number of replicas to transfer |
   *  | timeout | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @return
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | status.error_code | string | error code |
   *  | status.reason | string | error reason |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).resourceManager.transferNode({
   *    source_resource_group: 'source-resource-group',
   *    target_resource_group: 'target-resource-group',
   *    collection_name: 'my-collection',
   *    num_replica: 2
   * });
   * ```
   */
  /* istanbul ignore next */
  async transferReplica(data: TransferReplicaReq): Promise<ResStatus> {
    const promise = await promisify(
      this.client,
      'TransferReplica',
      data,
      data.timeout
    );
    return promise;
  }

  /**
   * transfer nodes from one resource group to another
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :--  | :-- |
   *  | source_resource_group | String | source resource group name |
   *  | target_resource_group | String | target resource group name |
   *  | num_node | Number | number of nodes to transfer |
   *  | timeout | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @return
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | status.error_code | string | error code |
   *  | status.reason | string | error reason |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).resourceManager.transferNode({
   *    source_resource_group: 'source-resource-group',
   *    target_resource_group: 'target-resource-group',
   *    num_node: 4
   * });
   * ```
   */
  /* istanbul ignore next */
  async transferNode(data: TransferNodeReq): Promise<ResStatus> {
    const promise = await promisify(
      this.client,
      'TransferNode',
      data,
      data.timeout
    );
    return promise;
  }

  /**
   * drop all resource groups, transfer all nodes to the default group
   *
   * @return
   *  | Property | Type | Description |
   *  | :-- | :-- | :-- |
   *  | status.error_code | string | error code |
   *  | status.reason | string[] | error reason |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).resourceManager.dropResourceGroups();
   * ```
   */
  async dropAllResourceGroups(): Promise<ResStatus[]> {
    // get all resource groups
    const { resource_groups } = await this.listResourceGroups();

    const res = [];

    // iterate over all resource groups
    // find the query nodes in it that need to be transferred
    // transfer those query nodes to the default group
    for (let i = 0; i < resource_groups.length; i++) {
      const sourceRg = resource_groups[i];
      if (sourceRg !== DEFAULT_RESOURCE_GROUP) {
        // get detail
        const detail = await this.describeResourceGroup({
          resource_group: sourceRg,
        });

        // if capacity is not 0, transfer node back
        if (detail.resource_group.capacity > 0) {
          // istanbul ignore next
          await this.transferNode({
            source_resource_group: sourceRg,
            target_resource_group: DEFAULT_RESOURCE_GROUP,
            num_node: detail.resource_group.capacity,
          });
        }

        // drop rg
        res.push(
          await this.dropResourceGroup({
            resource_group: sourceRg,
          })
        );
      }
    }
    return Promise.all(res);
  }
}
