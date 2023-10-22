import axios from 'axios';
import { HttpBaseClient } from '../HttpClient';
import { Constructor } from '../types/index';

export function Vector<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    insert(p: string) {
      console.log('insert', p, this.authorization);
    }
  };
}
