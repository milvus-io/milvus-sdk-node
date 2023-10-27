import fetch from 'node-fetch';
import { HttpClientConfig } from './types';
import { Collection, Vector } from './http';
import {
  DEFAULT_DB,
  DEFAULT_HTTP_TIMEOUT,
  DEFAULT_HTTP_ENDPOINT_VERSION,
} from '../milvus/const';

// base class
export class HttpBaseClient {
  // The client configuration.
  public config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    // Assign the configuration object.
    this.config = config;
  }

  // baseURL
  get baseURL() {
    return (
      this.config.baseURL ||
      `${this.config.endpoint}/${
        this.config.version || DEFAULT_HTTP_ENDPOINT_VERSION
      }`
    );
  }

  // authorization
  get authorization() {
    let token = this.config.token || '';

    if (!token && this.config.username && this.config.password) {
      token = this.config.username + ':' + this.config.password;
    }

    return `Bearer ${token}`;
  }

  // database
  get database() {
    return this.config.database || DEFAULT_DB;
  }

  // timeout
  get timeout() {
    return this.config.timeout || DEFAULT_HTTP_TIMEOUT;
  }

  get headers() {
    return {
      Authorization: this.authorization,
      Accept: 'application/json',
      ContentType: 'application/json',
    };
  }

  async POST<T>(url: string, data: Record<string, any> = {}): Promise<T> {
    try {
      // timeout controller
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), this.timeout);

      // assign data
      if (data) {
        data.dbName = data.dbName || this.database;
      }

      const response = await fetch(`${this.baseURL}${url}`, {
        method: 'post',
        headers: this.headers,
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(id);
      return response.json() as T;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('request was timeout');
      }
      return Promise.reject(error);
    }
  }

  async GET<T>(url: string, params: Record<string, any> = {}): Promise<T> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), this.timeout);

      // assign data
      if (params) {
        params.dbName = params.dbName || this.database;
      }

      const queryParams = new URLSearchParams(params);

      const response = await fetch(`${this.baseURL}${url}?${queryParams}`, {
        method: 'get',
        headers: this.headers,
        signal: controller.signal,
      });

      clearTimeout(id);

      return response.json() as T;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('request was timeout');
      }
      return Promise.reject(error);
    }
  }
}

// mixin APIs
export class HttpClient extends Collection(Vector(HttpBaseClient)) {}
