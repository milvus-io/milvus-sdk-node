import { HttpBaseClient } from '../HttpClient';
import {
  Constructor,
  FetchOptions,
  HttpBaseResponse,
  HttpCreateResourceGroupReq,
  HttpDescribeResourceGroupResponse,
  HttpResourceGroupReq,
  HttpTransferReplicaReq,
  HttpUpdateResourceGroupsReq,
} from '../types';
import { parseInt64Fields } from './parseInt64Fields';

const nodeIdFields = new Set(['node_id']);

export function ResourceGroup<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    get resourceGroupPrefix() {
      return '/vectordb/resource_groups';
    }

    createResourceGroup(
      params: HttpCreateResourceGroupReq,
      options?: FetchOptions
    ) {
      return this.POST<HttpBaseResponse>(
        `${this.resourceGroupPrefix}/create`,
        params,
        options
      );
    }

    dropResourceGroup(params: HttpResourceGroupReq, options?: FetchOptions) {
      return this.POST<HttpBaseResponse>(
        `${this.resourceGroupPrefix}/drop`,
        params,
        options
      );
    }

    listResourceGroups(options?: FetchOptions) {
      return this.POST<HttpBaseResponse<string[]>>(
        `${this.resourceGroupPrefix}/list`,
        {},
        options
      );
    }

    describeResourceGroup(
      params: HttpResourceGroupReq,
      options?: FetchOptions
    ) {
      return this.POST<HttpDescribeResourceGroupResponse>(
        `${this.resourceGroupPrefix}/describe`,
        params,
        options,
        body => parseInt64Fields(body, nodeIdFields)
      );
    }

    updateResourceGroups(
      params: HttpUpdateResourceGroupsReq,
      options?: FetchOptions
    ) {
      return this.POST<HttpBaseResponse>(
        `${this.resourceGroupPrefix}/alter`,
        params,
        options
      );
    }

    transferReplica(params: HttpTransferReplicaReq, options?: FetchOptions) {
      return this.POST<HttpBaseResponse>(
        `${this.resourceGroupPrefix}/transfer_replica`,
        params,
        options
      );
    }
  };
}
