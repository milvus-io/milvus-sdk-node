import { GrpcTimeOut, resStatusResponse, KeyValuePair } from './Common';
import { Properties } from './';

// base
export interface databaseReq extends GrpcTimeOut {
  db_name: string; // required, database name
}

// request
export interface CreateDatabaseRequest extends databaseReq {
  properties?: Properties; // optional, properties
}
export interface DropDatabasesRequest extends databaseReq {}
export interface DescribeDatabaseRequest extends databaseReq {}

// response
export interface ListDatabasesRequest extends GrpcTimeOut {}
export interface ListDatabasesResponse extends resStatusResponse {
  db_names: string[]; // database names
}
export interface DescribeDatabaseResponse extends resStatusResponse {
  db_name: string; // database name
  dbID: number; // database id
  created_timestamp: number; // created timestamp
  properties: KeyValuePair[]; // properties
}
export interface AlterDatabaseRequest extends GrpcTimeOut {
  db_name: string; // database name
  db_id?: string; // database id
  properties: Properties;
  delete_keys?: string[];
}

export interface DropDatabasePropertiesRequest extends GrpcTimeOut {
  db_name: string; // database name
  properties: string[]; // deleted properties
}
export interface AlterDatabaseResponse extends resStatusResponse {}
