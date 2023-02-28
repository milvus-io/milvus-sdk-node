import { DEFAULT_CONNECT_TIMEOUT } from '../milvus/const/Milvus';

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
