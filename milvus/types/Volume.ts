import { FetchOptions, HttpBaseResponse } from './Http';

export enum VolumeType {
  MANAGED = 'MANAGED',
  EXTERNAL = 'EXTERNAL',
}

export interface VolumeBaseReq {
  timeout?: number;
}

export interface VolumeCreateReq extends VolumeBaseReq {
  projectId: string;
  regionId: string;
  volumeName: string;
  type?: VolumeType | keyof typeof VolumeType | string;
  storageIntegrationId?: string;
  path?: string;
}

export interface VolumeListReq extends VolumeBaseReq {
  projectId: string;
  currentPage?: number;
  pageSize?: number;
  type?: VolumeType | keyof typeof VolumeType | string;
}

export interface VolumeNameReq extends VolumeBaseReq {
  volumeName: string;
}

export interface VolumeApplyReq extends VolumeNameReq {
  path: string;
}

export type VolumeResponse<T = Record<string, any>> = HttpBaseResponse<T>;

export interface VolumeManagerConfig {
  cloudEndpoint: string;
  apiKey: string;
  fetch?: typeof fetch;
  timeout?: number;
}

export interface VolumeRequestOptions extends Partial<FetchOptions> {}
