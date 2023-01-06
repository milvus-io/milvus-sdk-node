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
export interface HasRoleReq extends GrpcTimeOut {
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

export interface SelectUserReq extends GrpcTimeOut {
  username: string;
  includeRoleInfo?: boolean;
}

export interface OperateRolePrivilegeReq extends GrpcTimeOut {
  roleName: string; // grant role name
  object: string; // Type of the operational object to which the specified privilege belongs, such as Collection, Index, Partition, etc. This parameter is case-sensitive.
  objectName: string; // Name of the object to which the role is granted the specified prvilege.
  privilegeName: string; // Name of the privilege to be granted to the role. This parameter is case-sensitive.
}

export interface SelectGrantReq extends OperateRolePrivilegeReq {}

export interface ListGrantsReq extends GrpcTimeOut {
  roleName: string; // grant role name
}
