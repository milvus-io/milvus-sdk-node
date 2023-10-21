import { HttpClientConfig } from './types';
import { Collection, Vector } from './http';

// base class
export class HttpBaseClient {
  // The client configuration.
  public readonly config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    // Assign the configuration object.
    this.config = config;
  }
}

// mixin API
export class HttpClient extends Collection(Vector(HttpBaseClient)) {}
