export interface UpdateUserReq {
  username: string;
  oldPassword: string;
  newPassword: string;
}

export interface CreateUserReq {
  username: string;
  password: string;
}

export interface DeleteUserReq {
  username: string;
}
