import { DEFAULT_CONNECT_TIMEOUT } from '../milvus/const/Milvus';
import { KeyValuePair } from '../milvus/types/Common';

export function promisify(
  obj: any,
  target: string,
  params: any,
  timeout?: number
): Promise<any> {
  const deadline = timeout
    ? new Date(Date.now() + timeout)
    : new Date(Date.now() + DEFAULT_CONNECT_TIMEOUT);

  const res = new Promise((resolve, reject) => {
    try {
      obj[target](params, { deadline }, (err: any, result: any) => {
        if (err) {
          reject(err);
        }
        resolve(result);
      });
    } catch (e: any) {
      throw new Error(e);
    }
  }).catch(err => {
    throw new Error(err);
  });

  return res;
}

export const findKeyValue = (obj: KeyValuePair[], key: string) =>
  obj.find(v => v.key === key)?.value;

export const sleep = (time: number) => {
  return new Promise(resolve => setTimeout(resolve, time));
};
