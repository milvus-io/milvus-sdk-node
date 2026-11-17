import { DataType } from '../../milvus';
import { dataGenMap, genVarChar, genSparseVector } from '../fixtures/data';
import { seededRandom } from '../fixtures/random';

describe('Schema-compatible reproducible fixtures', () => {
  it('replays a seed and supports different exploration seeds', () => {
    const sample = (seed: number) => {
      const next = seededRandom(seed);
      return Array.from({ length: 10 }, next);
    };
    expect(sample(123)).toEqual(sample(123));
    expect(sample(123)).not.toEqual(sample(124));
  });
  it('keeps Int8 values within the signed type range', () => {
    for (let i = 0; i < 100; i++) {
      const value = dataGenMap[DataType.Int8]({}) as number;
      expect(value).toBeGreaterThanOrEqual(-128);
      expect(value).toBeLessThanOrEqual(127);
    }
  });
  it('respects short varchar limits even for preferred fruit values', () => {
    for (let i = 0; i < 100; i++)
      expect(
        (genVarChar({ max_length: 2 }) as string).length
      ).toBeLessThanOrEqual(2);
  });
  it.each(['csr', 'coo'])(
    'generates a sparse %s vector with dimension one',
    sparseType => {
      const vector = genSparseVector({ dim: 1, sparseType });
      expect(vector).toBeDefined();
    }
  );
});
