import { ResStatus, TimeStampArray, collectionNameReq } from './Common';
import { CollectionData } from './';

interface PartitionParent extends collectionNameReq {
  partition_name: string;
}
export interface CreatePartitionReq extends PartitionParent {}
export interface HasPartitionReq extends PartitionParent {}
export interface DropPartitionReq extends PartitionParent {}
export interface GetPartitionStatisticsReq extends PartitionParent {}
export interface ShowPartitionsReq extends collectionNameReq {}

export interface LoadPartitionsReq extends collectionNameReq {
  partition_names: string[]; // required, partition names
  replica_number?: number; // optional, replica number, default is 1
  resource_groups?: string[]; // optional, resource groups
}

export interface ReleasePartitionsReq extends collectionNameReq {
  partition_names: string[]; // required, partition names
}
export interface PartitionData extends CollectionData {}

export interface ShowPartitionsResponse extends TimeStampArray {
  status: ResStatus;
  partition_names: string[];
  partitionIDs: number[];
  data: PartitionData[];
}
