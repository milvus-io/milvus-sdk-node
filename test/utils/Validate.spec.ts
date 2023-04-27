import { checkSearchParams } from '../../utils';
import { ERROR_REASONS } from '../../milvus';

describe('utils/validate', () => {
  it('throws an error if vectors and vector are undefined', () => {
    const data = {
      collection_name: 'my_collection',
    };

    expect(() => checkSearchParams(data)).toThrowError(
      ERROR_REASONS.VECTORS_OR_VECTOR_IS_MISSING
    );
  });

  it('does not throw an error if vectors or vector is defined', () => {
    const data1 = {
      collection_name: 'my_collection',
      vectors: [[]],
    };

    const data2 = {
      collection_name: 'my_collection',
      vector: [],
    };

    expect(() => checkSearchParams(data1)).not.toThrow();
    expect(() => checkSearchParams(data2)).not.toThrow();
  });
});
