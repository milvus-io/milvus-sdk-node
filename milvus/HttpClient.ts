import { HttpClientConfig } from './types';
import { Collection, Vector } from './http';

export class API {
  // The client configuration.
  public readonly config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    // Assign the configuration object.
    this.config = config;
  }
}

export class HttpClient extends Collection(Vector(API)) {}
