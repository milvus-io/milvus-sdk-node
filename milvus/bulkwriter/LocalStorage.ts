import { Storage } from './Types';

export class LocalStorage implements Storage {
  async write(localPath: string, _remotePath: string): Promise<string> {
    return localPath;
  }
}
