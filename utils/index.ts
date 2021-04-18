export function promisify(obj: any, target: string, params: any): Promise<any> {
  const res = new Promise((resolve, reject) => {
    try {
      obj[target](params, (err: any, result: any) => {
        if (err) {
          reject(err);
        }
        resolve(result);
      });
    } catch (e) {
      throw new Error(e);
    }
  }).catch((err) => {
    console.error(err);
    throw new Error(err);
  });

  return res;
}

export function generateVectors(dimension: number, count: number = 10) {
  return new Array(count).fill(new Array(dimension).fill(Math.random() * 100));
}
