import { HttpClient, DEFAULT_DB } from '../../milvus';

describe(`HTTP Client test`, () => {
  it('should return the correct endpoint', () => {
    // Mock configuration object
    const config = {
      address: 'http://example.com',
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client = new HttpClient(config);
    expect(client.endpoint).toBe(config.address);
  });

  it('should return the correct authorization header', () => {
    // Mock configuration object
    const config = {
      address: 'http://example.com',
      username: 'user',
      password: 'pass',
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client = new HttpClient(config);
    const expectedAuthorization = `Authorization: Bearer ${config.username}:${config.password}`;
    expect(client.authorization).toBe(expectedAuthorization);

    const config2 = {
      address: 'http://example.com',
      token: 'token',
    };

    const client2 = new HttpClient(config2);
    const expectedAuthorization2 = `Authorization: Bearer ${config2.token}`;
    expect(client2.authorization).toBe(expectedAuthorization2);
  });

  it('should return the correct database', () => {
    // Mock configuration object
    const config = {
      address: 'http://example.com',
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client = new HttpClient(config);
    expect(client.database).toBe(DEFAULT_DB);
    // Mock configuration object
    const config2 = {
      address: 'http://example.com',
      database: 'db',
    };

    // Create an instance of HttpBaseClient with the mock configuration
    const client2 = new HttpClient(config2);
    expect(client2.database).toBe(config2.database);
  });
});
