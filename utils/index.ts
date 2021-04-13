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
  const vectors = [];
  while (count) {
    let vector = [];
    for (let i = 0; i < dimension; i++) {
      vector.push(Math.random() * 10000);
    }
    vectors.push(vector);
    count -= 1;
  }
  return vectors;
}
