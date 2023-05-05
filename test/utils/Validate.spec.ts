import { status as grpcStatus } from '@grpc/grpc-js';
import {
  checkSearchParams,
  isStatusCodeMatched,
  ERROR_REASONS,
} from '../../milvus';

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

  it('should return true if the code matches any of the given codes', () => {
    const code = grpcStatus.DEADLINE_EXCEEDED;
    const codesToCheck = [grpcStatus.DEADLINE_EXCEEDED, grpcStatus.UNAVAILABLE];
    const result = isStatusCodeMatched(code, codesToCheck);
    expect(result).toBe(true);
  });

  it('should return false if the code does not match any of the given codes', () => {
    const code = grpcStatus.OK;
    const codesToCheck = [grpcStatus.DEADLINE_EXCEEDED, grpcStatus.UNAVAILABLE];
    const result = isStatusCodeMatched(code, codesToCheck);
    expect(result).toBe(false);
  });

  it('should return true if the code matches the default codes to check', () => {
    const code = grpcStatus.DEADLINE_EXCEEDED;
    const result = isStatusCodeMatched(code);
    expect(result).toBe(true);
  });

  it('should return false if the code does not match the default codes to check', () => {
    const code = grpcStatus.OK;
    const result = isStatusCodeMatched(code);
    expect(result).toBe(false);
  });
});
