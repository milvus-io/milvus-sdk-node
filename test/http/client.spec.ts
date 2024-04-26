import { default as nodeFetch } from 'node-fetch';
import {
  HttpClient,
  DEFAULT_DB,
  DEFAULT_HTTP_TIMEOUT,
  DEFAULT_HTTP_ENDPOINT_VERSION,
} from '../../milvus';

describe(`HTTP Client test`, () => {
  const baseURL = 'http://192.168.0.1:19530';
  const username = 'user';
  const password = 'pass';
  const token = 'token';
  const database = 'db';
  const timeout = 5000;

  it('should return the correct baseURL', () => {
    // Mock configuration object
    const config = {
      baseURL,
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client = new HttpClient(config);
    expect(client.baseURL).toBe(baseURL);
  });

  it('should return the correct baseURL if only provide endpoint', () => {
    // Mock configuration object
    const config = {
      endpoint: baseURL,
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client = new HttpClient(config);
    expect(client.baseURL).toBe(
      `${config.endpoint}/${DEFAULT_HTTP_ENDPOINT_VERSION}`
    );
  });

  it('should return the correct authorization header', () => {
    // Mock configuration object
    const config = {
      baseURL,
      username,
      password,
      acceptInt64: true,
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client = new HttpClient(config);
    const expectedAuthorization = `Bearer ${config.username}:${config.password}`;
    expect(client.authorization).toBe(expectedAuthorization);
    expect(client.headers).toEqual({
      Authorization: expectedAuthorization,
      Accept: 'application/json',
      ContentType: 'application/json',
      'Accept-Type-Allow-Int64': 'true',
    });

    const config2 = {
      baseURL,
      token,
    };

    const client2 = new HttpClient(config2);
    const expectedAuthorization2 = `Bearer ${config2.token}`;
    expect(client2.authorization).toBe(expectedAuthorization2);
  });

  it('should return the correct database', () => {
    // Mock configuration object
    const config = {
      baseURL,
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client = new HttpClient(config);
    expect(client.database).toBe(DEFAULT_DB);
    // Mock configuration object
    const config2 = {
      baseURL,
      database,
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client2 = new HttpClient(config2);
    expect(client2.database).toBe(database);
  });

  it('should return the correct timeout', () => {
    // Mock configuration object
    const config = {
      baseURL,
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client = new HttpClient(config);
    expect(client.timeout).toBe(DEFAULT_HTTP_TIMEOUT);
    // Mock configuration object
    const config2 = {
      baseURL,
      timeout,
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client2 = new HttpClient(config2);
    expect(client2.timeout).toBe(timeout);
  });

  it('should using the correct fetch', () => {
    const config = {
      baseURL,
      fetch: nodeFetch,
    };
    const client = new HttpClient(config);
    expect(client.fetch).toEqual(nodeFetch);

    const config2 = {
      baseURL,
    };
    const client2 = new HttpClient(config2);
    expect(client2.fetch).toEqual(fetch);
  });
});
