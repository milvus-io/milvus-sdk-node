import { GrpcTimeOut, ResStatus, TimeStampArray } from './Common';

interface PartitionParent extends GrpcTimeOut {
  collection_name: string;
  partition_name: string;
}
export interface CreatePartitionReq extends PartitionParent {}

export interface HasPartitionReq extends PartitionParent {}

export interface DropPartitionReq extends PartitionParent {}

export interface GetPartitionStatisticsReq extends PartitionParent {}

export interface ShowPartitionsReq extends GrpcTimeOut {
  collection_name: string;
}

export interface LoadPartitionsReq extends GrpcTimeOut {
  collection_name: string;
  partition_names: string[];
}

export interface ReleasePartitionsReq extends GrpcTimeOut {
  collection_name: string;
  partition_names: string[];
}

export interface ShowPartitionsResponse extends TimeStampArray {
  status: ResStatus;
  partition_names: string[];
  partitionIDs: number[];
}
