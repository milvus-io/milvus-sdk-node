import { HttpClientConfig, FetchOptions } from './types';
import {
  Collection,
  Vector,
  User,
  Role,
  Partition,
  MilvusIndex,
  Alias,
  Import,
} from './http';
import {
  DEFAULT_DB,
  DEFAULT_HTTP_TIMEOUT,
  DEFAULT_HTTP_ENDPOINT_VERSION,
} from '../milvus/const';

/**
 * HttpBaseClient is a base class for making HTTP requests to a Milvus server.
 * It provides basic functionality for making GET and POST requests, and handles
 * configuration, headers, and timeouts.
 *
 * The HttpClientConfig object should contain the following properties:
 * - endpoint: The URL of the Milvus server.
 * - username: (Optional) The username for authentication.
 * - password: (Optional) The password for authentication.
 * - token: (Optional) The token for authentication.
 * - fetch: (Optional) An alternative fetch API implementation, e.g., node-fetch for Node.js environments.
 * - baseURL: (Optional) The base URL for the API endpoints.
 * - version: (Optional) The version of the API endpoints.
 * - database: (Optional) The default database to use for requests.
 * - timeout: (Optional) The timeout for requests in milliseconds.
 *
 * Note: This is a base class and does not provide specific methods for interacting
 * with Milvus entities like collections or vectors. For that, use the HttpClient class
 * which extends this class and mixes in the Collection and Vector APIs.
 */
export class HttpBaseClient {
  // The client configuration.
  public config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    // Assign the configuration object.
    this.config = config;

    // The fetch method used for requests can be customized by providing a fetch property in the configuration.
    // If no fetch method is provided, the global fetch method will be used if available.
    // If no global fetch method is available, an error will be thrown.
    if (!this.config.fetch && typeof fetch === 'undefined') {
      throw new Error(
        'The Fetch API is not supported in this environment. Please provide an alternative, for example, node-fetch.'
      );
    }
  }

  // baseURL
  get baseURL() {
    return (
      this.config.baseURL ||
      `${this.config.endpoint}/${DEFAULT_HTTP_ENDPOINT_VERSION}`
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
    return this.config.database ?? DEFAULT_DB;
  }

  // timeout
  get timeout() {
    return this.config.timeout ?? DEFAULT_HTTP_TIMEOUT;
  }

  // headers
  get headers() {
    return {
      Authorization: this.authorization,
      Accept: 'application/json',
      ContentType: 'application/json',
      'Accept-Type-Allow-Int64':
        typeof this.config.acceptInt64 !== 'undefined'
          ? this.config.acceptInt64.toString()
          : 'false',
    };
  }

  // fetch
  get fetch() {
    return this.config.fetch ?? fetch;
  }

  // POST API
  async POST<T>(
    url: string,
    data: Record<string, any> = {},
    options?: FetchOptions
  ): Promise<T> {
    try {
      // timeout controller
      const timeout = options?.timeout ?? this.timeout;
      const abortController = options?.abortController ?? new AbortController();
      const id = setTimeout(() => abortController.abort(), timeout);

      // assign database
      if (data) {
        data.dbName = data.dbName ?? this.database;
      }

      const response = await this.fetch(`${this.baseURL}${url}`, {
        method: 'post',
        headers: this.headers,
        body: JSON.stringify(data),
        signal: abortController.signal,
      });

      clearTimeout(id);
      return response.json() as T;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`post ${url} request was timeout`);
      }
      return Promise.reject(error);
    }
  }

  // GET API
  async GET<T>(
    url: string,
    params: Record<string, any> = {},
    options?: FetchOptions
  ): Promise<T> {
    try {
      // timeout controller
      const timeout = options?.timeout ?? this.timeout;
      const abortController = options?.abortController ?? new AbortController();
      const id = setTimeout(() => abortController.abort(), timeout);

      // assign database
      if (params) {
        params.dbName = params.dbName ?? this.database;
      }

      const queryParams = new URLSearchParams(params);

      const response = await this.fetch(
        `${this.baseURL}${url}?${queryParams}`,
        {
          method: 'get',
          headers: this.headers,
          signal: abortController.signal,
        }
      );

      clearTimeout(id);

      return response.json() as T;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`milvus http client: request was timeout`);
      }
      return Promise.reject(error);
    }
  }
}

/**
 * The HttpClient class extends the functionality
 * of the HttpBaseClient class by mixing in the
 * - Collection
 * - Vector
 * - Alias
 * - Partition
 * - MilvusIndex
 * - Import
 * - Role
 * - User APIs.
 */
export class HttpClient extends User(
  Role(
    MilvusIndex(Import(Alias(Partition(Collection(Vector(HttpBaseClient))))))
  )
) {}
