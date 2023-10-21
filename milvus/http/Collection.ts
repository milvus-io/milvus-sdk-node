import axios from 'axios';
import { HttpBaseClient } from '../HttpClient';
import { Constructor } from '../types/index';

export function Collection<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    createCollection(p: string) {
      console.log('createCollection', p, this.config);
    }
  };
}
