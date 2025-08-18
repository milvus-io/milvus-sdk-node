import { validateFloat16Vector } from '../../milvus/bulk-writer/validators/Float16Vector';

describe('Float16Vector Validation', () => {
  const dim = 4;
  const testArray = [1.0, 2.0, 3.0, 4.0];

  describe('Array Input', () => {
    it('should validate and convert array to Uint8Array', () => {
      const result = validateFloat16Vector(testArray, dim);

      expect(result.value).toBeInstanceOf(Uint8Array);
      expect(result.size).toBe(dim * 2); // 2 bytes per dimension for f16
      expect(result.value.length).toBe(8);
    });

    it('should throw error for wrong dimension', () => {
      expect(() => {
        validateFloat16Vector(testArray, 2); // Wrong dimension
      }).toThrow('Invalid float vector: expected array with dim=2');
    });

    it('should handle empty array', () => {
      const result = validateFloat16Vector([], 0);
      expect(result.value).toBeInstanceOf(Uint8Array);
      expect(result.size).toBe(0);
    });
  });

  describe('Base64 String Input', () => {
    it('should validate and convert base64 string to Uint8Array', () => {
      // First create a valid base64 string from array
      const arrayResult = validateFloat16Vector(testArray, dim);
      const base64String = Buffer.from(arrayResult.value).toString('base64');

      const result = validateFloat16Vector(base64String, dim);

      expect(result.value).toBeInstanceOf(Uint8Array);
      expect(result.size).toBe(dim * 2);
      expect(result.value.length).toBe(8);
    });

    it('should throw error for invalid base64 string', () => {
      expect(() => {
        validateFloat16Vector('invalid-base64!@#', dim);
      }).toThrow('Invalid base64 string for Float16Vector');
    });

    it('should throw error for base64 with wrong length', () => {
      expect(() => {
        validateFloat16Vector('AA==', dim); // 1 byte, should be 8 bytes
      }).toThrow(
        'Invalid Float16Vector base64: expected length 8 bytes, got 1'
      );
    });
  });

  describe('Uint8Array Input', () => {
    it('should validate existing Uint8Array', () => {
      const arrayResult = validateFloat16Vector(testArray, dim);
      const uint8Array = arrayResult.value;

      const result = validateFloat16Vector(uint8Array, dim);

      expect(result.value).toBeInstanceOf(Uint8Array);
      expect(result.size).toBe(dim * 2);
      expect(result.value).toBe(uint8Array); // Should return the same reference
    });

    it('should throw error for Uint8Array with wrong length', () => {
      const wrongArray = new Uint8Array(4); // Wrong length

      expect(() => {
        validateFloat16Vector(wrongArray, dim);
      }).toThrow('Invalid Float16Vector bytes: expected length 8, got 4');
    });
  });

  describe('Round-trip Conversion', () => {
    it('should maintain data integrity through array -> bytes -> base64 -> bytes conversion', () => {
      // Array -> bytes
      const arrayResult = validateFloat16Vector(testArray, dim);

      // Bytes -> base64
      const base64String = Buffer.from(arrayResult.value).toString('base64');

      // Base64 -> bytes
      const base64Result = validateFloat16Vector(base64String, dim);

      // Compare the two Uint8Array results
      expect(base64Result.value).toBeInstanceOf(Uint8Array);
      expect(base64Result.size).toBe(arrayResult.size);

      // Verify the data is identical
      const array1 = Array.from(arrayResult.value);
      const array2 = Array.from(base64Result.value);
      expect(array1).toEqual(array2);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for null input', () => {
      expect(() => {
        validateFloat16Vector(null as any, dim);
      }).toThrow('Invalid float vector: expected array with dim=4');
    });

    it('should throw error for undefined input', () => {
      expect(() => {
        validateFloat16Vector(undefined as any, dim);
      }).toThrow('Invalid float vector: expected array with dim=4');
    });

    it('should throw error for non-array object', () => {
      expect(() => {
        validateFloat16Vector({ key: 'value' } as any, dim);
      }).toThrow('Invalid float vector: expected array with dim=4');
    });
  });
});
