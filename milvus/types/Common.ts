import {
  CollectionPrivileges,
  UserPrivileges,
  GlobalPrivileges,
  MsgType,
} from '..';

export interface MsgBase {
  base: {
    msg_type: MsgType; // required
  };
}

export interface KeyValuePair {
  key: string;
  value: string | number;
}

export enum IndexState {
  IndexStateNone = 0,
  Unissued = 1,
  InProgress = 2,
  Finished = 3,
  Failed = 4,
}

export enum DslType {
  Dsl = 0,
  BoolExprV1 = 1,
}

interface NumberArray {
  data: Number[];
}

interface StringArray {
  data: String[];
}
export interface NumberArrayId {
  int_id: NumberArray;
}

export interface StringArrayId {
  str_id: StringArray;
}
export interface GrpcTimeOut {
  timeout?: number;
}
export type PrivilegesTypes =
  | CollectionPrivileges
  | UserPrivileges
  | GlobalPrivileges;

export interface ResStatus {
  error_code: string | number;
  reason: string;
}

export interface TimeStamp {
  created_timestamp: string; // hybrid timestamp it's milvus inside timestamp
  created_utc_timestamp: string;
}

export interface TimeStampArray {
  created_timestamps: string[];
  created_utc_timestamps: string[];
}

export interface keyValueObj {
  [key: string]: string | number;
}
