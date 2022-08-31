import { GrpcTimeOut } from './Common';

export interface UpdateUserReq extends GrpcTimeOut {
  username: string;
  oldPassword: string;
  newPassword: string;
}

export interface CreateUserReq extends GrpcTimeOut {
  username: string;
  password: string;
}

export interface DeleteUserReq extends GrpcTimeOut {
  username: string;
}

export interface ListUsersReq extends GrpcTimeOut {}
