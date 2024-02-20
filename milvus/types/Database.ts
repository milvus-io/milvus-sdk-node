import { GrpcTimeOut, resStatusResponse } from './Common';

// base
export interface databaseReq extends GrpcTimeOut {
  db_name: string; // required, database name
}
export interface CreateDatabaseRequest extends databaseReq {}
export interface DropDatabasesRequest extends databaseReq {}
export interface ListDatabasesRequest extends GrpcTimeOut {}
export interface ListDatabasesResponse extends resStatusResponse {
  db_names: string[]; // database names
}
