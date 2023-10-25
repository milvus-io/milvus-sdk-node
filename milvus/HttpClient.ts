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
  public config: HttpClientConfig;

  // axios
  public client: AxiosInstance;

  constructor(config: HttpClientConfig) {
    // Assign the configuration object.
    this.config = config;

    // setup axios client
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      timeoutErrorMessage: '',
      withCredentials: true,
      headers: {
        Authorization: this.authorization,
        Accept: 'application/json',
        ContentType: 'application/json',
      },
    });

    // interceptors
    this.client.interceptors.request.use(request => {
      // if dbName is not set, using default database
      // GET
      if (request.params) {
        request.params.dbName = request.params.dbName || this.database;
      }
      // POST
      if (request.data) {
        request.data.dbName = request.data.dbName || this.database;
        request.data = JSON.stringify(request.data);
      }

      // console.log('request: ', request.data);
      return request;
    });
    this.client.interceptors.response.use(response => {
      return response.data;
    });
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

  get POST() {
    return this.client.post;
  }

  get GET() {
    return this.client.get;
  }
}

// mixin APIs
export class HttpClient extends Collection(Vector(HttpBaseClient)) {}
