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
    throw new Error(err);
  });

  return res;
}

export function generateInsertData(
  fields: { isVector: boolean; dim?: number; name: string; isBool?: boolean }[],
  count: number
) {
  const results = [];
  while (count > 0) {
    let value: any = {};

    fields.forEach((v) => {
      const { isVector, dim, name, isBool } = v;
      value[name] = isVector
        ? [...Array(dim)].map(() => Math.random() * 10)
        : isBool
        ? count % 2 === 0
        : count;
    });
    results.push(value);
    count--;
  }
  return results;
}
