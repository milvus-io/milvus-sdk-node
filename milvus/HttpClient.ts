import axios from 'axios';
import { HttpClientConfig } from './types';

export class HttpClient {
  id = 1;

  // The client configuration.
  public readonly config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    // Assign the configuration object.
    this.config = config;
  }
}
