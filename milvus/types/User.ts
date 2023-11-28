import { GrpcTimeOut, PrivilegesTypes, resStatusResponse } from './Common';
import { RbacObjects } from '../';

// base
export interface usernameReq extends GrpcTimeOut {
  username: string;
}
export interface roleNameReq extends GrpcTimeOut {
  roleName: string;
}

export interface CreateUserReq extends usernameReq {
  password: string;
}
export interface DeleteUserReq extends usernameReq {}
export interface UpdateUserReq extends usernameReq {
  oldPassword: string;
  newPassword: string;
}
export interface ListUsersReq extends GrpcTimeOut {}

export interface CreateRoleReq extends roleNameReq {}
export interface DropRoleReq extends roleNameReq {}
export interface HasRoleReq extends roleNameReq {}
export interface AddUserToRoleReq extends roleNameReq {
  username: string;
}
export interface RemoveUserFromRoleReq extends AddUserToRoleReq {
  roleName: string;
}
export interface SelectRoleReq extends roleNameReq {
  includeUserInfo?: boolean;
}
export interface listRoleReq extends GrpcTimeOut {
  includeUserInfo?: boolean;
}
export interface SelectUserReq extends usernameReq {
  includeRoleInfo?: boolean;
}
export interface OperateRolePrivilegeReq extends roleNameReq {
  object: RbacObjects; // Type of the operational object to which the specified privilege belongs, such as Collection, Index, Partition, etc. This parameter is case-sensitive.
  objectName: string; // Name of the object to which the role is granted the specified prvilege.
  privilegeName: PrivilegesTypes; // Name of the privilege to be granted to the role. This parameter is case-sensitive.
}
export interface SelectGrantReq extends OperateRolePrivilegeReq {}
export interface ListGrantsReq extends roleNameReq {}

export interface ListCredUsersResponse extends resStatusResponse {
  usernames: string[];
}

export type RoleEntity = { name: string };
export type User = { name: string };
export type RoleResult = {
  users: User[];
  role: RoleEntity;
  entities: GrantEntity[];
};
export interface SelectRoleResponse extends resStatusResponse {
  results: RoleResult[];
}

export type UserResult = { user: User; roles: RoleEntity[] };
export interface SelectUserResponse extends resStatusResponse {
  results: UserResult[];
}
export type ObjectEntity = { name: RbacObjects };
export type PrivilegeEntity = { name: PrivilegesTypes };
export type Grantor = { user: User; privilege: PrivilegeEntity };
export type GrantEntity = {
  role: RoleEntity;
  object: ObjectEntity;
  object_name: string;
  grantor: Grantor;
  db_name: string;
};
export interface SelectGrantResponse extends resStatusResponse {
  entities: GrantEntity[];
}

export interface HasRoleResponse extends resStatusResponse {
  hasRole: boolean;
}
