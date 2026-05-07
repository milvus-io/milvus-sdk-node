import {
  DEFAULT_HTTP_TIMEOUT,
  VolumeApplyReq,
  VolumeCreateReq,
  VolumeListReq,
  VolumeManagerConfig,
  VolumeNameReq,
  VolumeRequestOptions,
  VolumeResponse,
} from '../';

export class VolumeManager {
  private readonly cloudEndpoint: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeout: number;

  constructor(config: VolumeManagerConfig);
  constructor(cloudEndpoint: string, apiKey: string, fetchImpl?: typeof fetch);
  constructor(
    configOrEndpoint: VolumeManagerConfig | string,
    apiKey?: string,
    fetchImpl?: typeof fetch
  ) {
    if (typeof configOrEndpoint === 'string') {
      this.cloudEndpoint = configOrEndpoint;
      this.apiKey = apiKey || '';
      this.fetchImpl = fetchImpl || fetch;
      this.timeout = DEFAULT_HTTP_TIMEOUT;
    } else {
      this.cloudEndpoint = configOrEndpoint.cloudEndpoint;
      this.apiKey = configOrEndpoint.apiKey;
      this.fetchImpl = configOrEndpoint.fetch || fetch;
      this.timeout = configOrEndpoint.timeout || DEFAULT_HTTP_TIMEOUT;
    }
  }

  async createVolume(
    data: VolumeCreateReq,
    options?: VolumeRequestOptions
  ): Promise<VolumeResponse> {
    const { timeout, ...params } = data;
    return this.POST('/v2/volumes/create', params, {
      ...options,
      timeout: options?.timeout ?? timeout ?? this.timeout,
    });
  }

  async listVolumes(
    data: VolumeListReq,
    options?: VolumeRequestOptions
  ): Promise<VolumeResponse> {
    const { timeout, ...params } = data;
    return this.GET('/v2/volumes', params, {
      ...options,
      timeout: options?.timeout ?? timeout ?? this.timeout,
    });
  }

  async deleteVolume(
    data: VolumeNameReq,
    options?: VolumeRequestOptions
  ): Promise<VolumeResponse> {
    const { timeout, volumeName } = data;
    return this.DELETE(`/v2/volumes/${encodeURIComponent(volumeName)}`, {
      ...options,
      timeout: options?.timeout ?? timeout ?? this.timeout,
    });
  }

  async describeVolume(
    data: VolumeNameReq,
    options?: VolumeRequestOptions
  ): Promise<VolumeResponse> {
    const { timeout, volumeName } = data;
    return this.GET(
      `/v2/volumes/${encodeURIComponent(volumeName)}`,
      {},
      {
        ...options,
        timeout: options?.timeout ?? timeout ?? this.timeout,
      }
    );
  }

  async applyVolume(
    data: VolumeApplyReq,
    options?: VolumeRequestOptions
  ): Promise<VolumeResponse> {
    const { timeout, ...params } = data;
    return this.POST('/v2/volumes/apply', params, {
      ...options,
      timeout: options?.timeout ?? timeout ?? this.timeout,
    });
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
      ContentType: 'application/json',
    };
  }

  private get baseURL() {
    return this.cloudEndpoint.replace(/\/+$/, '');
  }

  private async handleResponse<T>(response: Response, url: string): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `HTTP ${response.status} ${response.statusText}: ${url}${
          errorText ? ` - ${errorText}` : ''
        }`
      );
    }
    return response.json() as T;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    data?: Record<string, any>,
    options?: VolumeRequestOptions
  ): Promise<T> {
    let id: ReturnType<typeof setTimeout> | undefined;
    const timeout = options?.timeout ?? this.timeout;
    const abortController = options?.abortController ?? new AbortController();

    try {
      id = setTimeout(() => abortController.abort(), timeout);
      const url = this.buildUrl(path, method === 'GET' ? data : undefined);
      const init: RequestInit = {
        method,
        headers: this.headers,
        signal: abortController.signal,
      };

      if (method === 'POST') {
        init.body = JSON.stringify(data || {});
      }

      const response = await this.fetchImpl(url, init);
      return this.handleResponse<T>(response, url);
    } finally {
      if (id !== undefined) {
        clearTimeout(id);
      }
    }
  }

  private buildUrl(path: string, params?: Record<string, any>) {
    const url = `${this.baseURL}${path}`;
    if (!params || Object.keys(params).length === 0) {
      return url;
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    const query = searchParams.toString();
    return query ? `${url}?${query}` : url;
  }

  private GET<T>(
    path: string,
    params?: Record<string, any>,
    options?: VolumeRequestOptions
  ) {
    return this.request<T>('GET', path, params, options);
  }

  private POST<T>(
    path: string,
    data?: Record<string, any>,
    options?: VolumeRequestOptions
  ) {
    return this.request<T>('POST', path, data, options);
  }

  private DELETE<T>(path: string, options?: VolumeRequestOptions) {
    return this.request<T>('DELETE', path, undefined, options);
  }

  create_volume = this.createVolume;
  list_volumes = this.listVolumes;
  delete_volume = this.deleteVolume;
  describe_volume = this.describeVolume;
  apply_volume = this.applyVolume;
}
