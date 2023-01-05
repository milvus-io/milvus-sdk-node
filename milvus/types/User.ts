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

export interface CreateRoleReq extends GrpcTimeOut {
  roleName: string;
}

export interface DropRoleReq extends GrpcTimeOut {
  roleName: string;
}

export interface AddUserToRoleReq extends GrpcTimeOut {
  username: string;
  roleName: string;
}

export interface RemoveUserFromRoleReq extends GrpcTimeOut {
  username: string;
  roleName: string;
}

export interface SelectRoleReq extends GrpcTimeOut {
  roleName: string;
  includeUserInfo?: boolean;
}

