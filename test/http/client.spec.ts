import { HttpClient, DEFAULT_DB, DEFAULT_HTTP_TIMEOUT } from '../../milvus';

describe(`HTTP Client test`, () => {
  it('should return the correct baseURL', () => {
    // Mock configuration object
    const config = {
      baseURL: 'http://example.com',
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client = new HttpClient(config);
    expect(client.baseURL).toBe(config.baseURL);
  });

  it('should return the correct baseURL if only provide address', () => {
    // Mock configuration object
    const config = {
      address: 'https://192.168.0.1:19530',
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client = new HttpClient(config);
    expect(client.baseURL).toBe(`${config.address}/v1`);
  });

  it('should return the correct baseURL if version is defined', () => {
    // Mock configuration object
    const config = {
      address: 'https://192.168.0.1:19530',
      version: 'v3',
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client = new HttpClient(config);
    expect(client.baseURL).toBe(`${config.address}/v3`);
  });

  it('should return the correct authorization header', () => {
    // Mock configuration object
    const config = {
      baseURL: 'http://example.com',
      username: 'user',
      password: 'pass',
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client = new HttpClient(config);
    const expectedAuthorization = `Bearer ${config.username}:${config.password}`;
    expect(client.authorization).toBe(expectedAuthorization);

    const config2 = {
      baseURL: 'http://example.com',
      token: 'token',
    };

    const client2 = new HttpClient(config2);
    const expectedAuthorization2 = `Bearer ${config2.token}`;
    expect(client2.authorization).toBe(expectedAuthorization2);
  });

  it('should return the correct database', () => {
    // Mock configuration object
    const config = {
      baseURL: 'http://example.com',
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client = new HttpClient(config);
    expect(client.database).toBe(DEFAULT_DB);
    // Mock configuration object
    const config2 = {
      baseURL: 'http://example.com',
      database: 'db',
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client2 = new HttpClient(config2);
    expect(client2.database).toBe(config2.database);
  });

  it('should return the correct timeout', () => {
    // Mock configuration object
    const config = {
      baseURL: 'http://example.com',
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client = new HttpClient(config);
    expect(client.timeout).toBe(DEFAULT_HTTP_TIMEOUT);
    // Mock configuration object
    const config2 = {
      baseURL: 'http://example.com',
      timeout: 100,
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client2 = new HttpClient(config2);
    expect(client2.timeout).toBe(config2.timeout);
  });
});
