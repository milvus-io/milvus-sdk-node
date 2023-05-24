import { GrpcTimeOut, ResStatus } from './Common';

export interface DatabaseNameReq {
  db_name?: string;
}

export interface CreateDatabaseRequest extends GrpcTimeOut {
  db_name: string;
}
export interface ListDatabasesRequest extends GrpcTimeOut {}
export interface DropDatabasesRequest extends CreateDatabaseRequest {}
export interface ListDatabasesResponse {
  db_names: string[];
  status: ResStatus;
}
