import axios from 'axios';
import { API } from '../HttpClient';
import { Constructor } from '../types/index';

export function Collection<T extends Constructor<API>>(Base: T) {
  return class extends Base {
    createCollection(p: string) {
      console.log('createCollection', p, this.config);
    }
  };
}
