import { GrpcTimeOut, PrivilegesTypes, resStatusResponse } from './Common';
import { RbacObjects, OperatePrivilegeGroupType } from '../';

// base
export interface usernameReq extends GrpcTimeOut {
  username: string; // required, username
}
export interface roleNameReq extends GrpcTimeOut {
  roleName: string; // required, role name
}

export interface CreateUserReq extends usernameReq {
  password: string; // required, password
}
export interface DeleteUserReq extends usernameReq {}
export interface UpdateUserReq extends usernameReq {
  oldPassword: string; // required, old password
  newPassword: string; // required, new password
}
export interface ListUsersReq extends GrpcTimeOut {}

export interface CreateRoleReq extends roleNameReq {}
export interface DropRoleReq extends roleNameReq {}
export interface HasRoleReq extends roleNameReq {}
export interface AddUserToRoleReq extends roleNameReq {
  username: string; // required, username
}
export interface RemoveUserFromRoleReq extends AddUserToRoleReq {
  roleName: string; // required, role name
}
export interface SelectRoleReq extends roleNameReq {
  includeUserInfo?: boolean; // optional, include user info, default is false
}
export interface listRoleReq extends GrpcTimeOut {
  includeUserInfo?: boolean; // optional, include user info, default is false
}
export interface SelectUserReq extends usernameReq {
  includeRoleInfo?: boolean; // optional, include role info, default is false
}

export interface BaseGrantReq extends roleNameReq {
  object: RbacObjects; // Type of the operational object to which the specified privilege belongs, such as Collection, Index, Partition, etc. This parameter is case-sensitive.
  objectName: string; // Name of the object to which the role is granted the specified prvilege.
}
export interface OperateRolePrivilegeReq extends BaseGrantReq {
  privilegeName: PrivilegesTypes; // Name of the privilege to be granted to the role. This parameter is case-sensitive.
}
export interface SelectGrantReq extends BaseGrantReq {}
export interface ListGrantsReq extends roleNameReq {}

export interface ListCredUsersResponse extends resStatusResponse {
  usernames: string[]; // usernames
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

export interface CreatePrivilegeGroupReq extends GrpcTimeOut {
  group_name: string; // required, name
}

export interface DropPrivilegeGroupReq extends GrpcTimeOut {
  group_name: string; // required, name
}

export type PrivelegeGroup = {
  group_name: string; // name
  privileges: PrivilegeEntity[]; // privileges
};

export interface ListPrivilegeGroupsResponse extends resStatusResponse {
  privilege_groups: PrivelegeGroup[]; // privilege groups
}

export interface OperatePrivilegeGroupReq extends GrpcTimeOut {
  group_name: string; // required, group name
  privileges: PrivilegeEntity[]; // required, privileges
  type: OperatePrivilegeGroupType; // required, operation type
}
