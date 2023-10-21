import axios from 'axios';
import { API } from '../HttpClient';
import { Constructor } from '../types/index';

export function Vector<T extends Constructor<API>>(Base: T) {
  return class extends Base {
    insert(p: string) {
      console.log('insert', p, this.config);
    }
  };
}
