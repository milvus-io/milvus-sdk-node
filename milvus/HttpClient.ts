import { HttpClientConfig } from './types';
import { Collection, Vector } from './http';
import { DEFAULT_DB } from '../milvus/const';

// base class
export class HttpBaseClient {
  // The client configuration.
  protected _config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    // Assign the configuration object.
    this._config = config;
  }

  // endpoint
  get endpoint() {
    return this._config.url || this._config.address;
  }

  // authorization
  get authorization() {
    let token = this._config.token || '';

    if (!token && this._config.username && this._config.password) {
      token = this._config.username + ':' + this._config.password;
    }

    return `Authorization: Bearer ${token}`;
  }

  // database
  get database() {
    return this._config.database || DEFAULT_DB;
  }
}

// mixin APIs
export class HttpClient extends Collection(Vector(HttpBaseClient)) {}
