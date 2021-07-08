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
  const result = [];
  while (count > 0) {
    const value = Math.random() * 10;
    result.push(Math.round(value));
    count--;
  }
  return result;
}

export function generateIds(count: number) {
  const result = [];
  while (count > 0) {
    result.push(count);
    count--;
  }
  return result;
}
