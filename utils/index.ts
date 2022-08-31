export function promisify(
  obj: any,
  target: string,
  params: any,
  timeout?: number
): Promise<any> {
  const deadline = timeout ? new Date(Date.now() + timeout) : timeout;

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

export function generateInsertData(
  fields: { isVector: boolean; dim?: number; name: string; isBool?: boolean }[],
  count: number
) {
  const results = [];
  while (count > 0) {
    let value: any = {};

    fields.forEach(v => {
      const { isVector, dim, name, isBool } = v;
      value[name] = isVector
        ? [...Array(dim)].map(() => Math.random() * 10)
        : isBool
        ? count % 2 === 0
        : Math.floor(Math.random() * 100000);
    });
    results.push(value);
    count--;
  }
  return results;
}
