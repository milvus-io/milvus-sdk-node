import axios, { AxiosInstance } from 'axios';
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
  protected _config: HttpClientConfig;

  protected _client: AxiosInstance;

  constructor(config: HttpClientConfig) {
    // Assign the configuration object.
    this._config = config;

    // setup axios client
    this._client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      timeoutErrorMessage: '',
      withCredentials: true,
      headers: {
        Authorization: this.authorization,
      },
    });
  }

  // baseURL
  get baseURL() {
    return (
      this._config.baseURL ||
      `${this._config.address}/${
        this._config.version || DEFAULT_HTTP_ENDPOINT_VERSION
      }`
    );
  }

  // authorization
  get authorization() {
    let token = this._config.token || '';

    if (!token && this._config.username && this._config.password) {
      token = this._config.username + ':' + this._config.password;
    }

    return `Bearer ${token}`;
  }

  // database
  get database() {
    return this._config.database || DEFAULT_DB;
  }

  // timeout
  get timeout() {
    return this._config.timeout || DEFAULT_HTTP_TIMEOUT;
  }

  // client
  get client() {
    return this._client;
  }

  get post() {
    return this.client.post;
  }

  get get() {
    return this.client.get;
  }
}

// mixin APIs
export class HttpClient extends Collection(Vector(HttpBaseClient)) {}
