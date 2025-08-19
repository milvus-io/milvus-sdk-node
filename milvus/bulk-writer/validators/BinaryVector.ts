/**
 * Converts a bit array to bytes using packBits algorithm
 * @param bits - Array of bits (0 or 1)
 * @returns Array of bytes
 */
function packBits(bits: number[]): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8 && i + j < bits.length; j++) {
      if (bits[i + j]) {
        byte |= 1 << (7 - j); // Set bit from left to right
      }
    }
    bytes.push(byte);
  }
  return bytes;
}

export function validateBinaryVector(
  x: unknown,
  field: any
): { value: number[]; size: number } {
  const dim = Number(field.dim) || 0;
  // Binary vector is stored as bytes where 8 dim == 1 byte
  const byteLen = Math.ceil(dim / 8);

  // Handle bytes input (Uint8Array or Buffer)
  if (x instanceof Uint8Array) {
    if (x.length !== byteLen) {
      throw new Error(
        `Invalid binary vector bytes: expected length ${byteLen}, got ${x.length}`
      );
    }
    return { value: Array.from(x), size: byteLen };
  }

  if (
    x &&
    typeof x === 'object' &&
    x.constructor &&
    x.constructor.name === 'Buffer'
  ) {
    const buffer = x as any;
    if (buffer.length !== byteLen) {
      throw new Error(
        `Invalid binary vector bytes: expected length ${byteLen}, got ${buffer.length}`
      );
    }
    return { value: Array.from(buffer), size: byteLen };
  }

  // Handle base64-encoded string input (e.g., "AAECAwQFBgc=")
  if (typeof x === 'string') {
    // First check if it looks like a valid base64 string
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(x)) {
      throw new Error(
        `Invalid binary vector: expected Uint8Array, Buffer, base64 string, or array, got string`
      );
    }

    try {
      const bytes = Buffer.from(x, 'base64');
      if (bytes.length !== byteLen) {
        throw new Error(
          `Invalid binary vector bytes: expected length ${byteLen}, got ${bytes.length}`
        );
      }
      return { value: Array.from(bytes), size: byteLen };
    } catch (error) {
      throw new Error(
        `Invalid binary vector base64 string: ${
          error instanceof Error ? error.message : 'Invalid format'
        }`
      );
    }
  }

  // Handle bit array input (e.g., [1, 0, 1, 1, 0, 0, 1, 0])
  if (Array.isArray(x)) {
    // Check if it's a bit array (all values are 0 or 1) AND length matches dimension
    const isBitArray = x.length === dim && x.every(v => v === 0 || v === 1);

    if (isBitArray) {
      // Convert bit array to bytes using packBits
      return { value: packBits(x), size: byteLen };
    } else {
      // Traditional byte array validation
      if (x.length !== byteLen) {
        throw new Error(
          `Invalid binary vector: expected array with length=${byteLen}`
        );
      }

      const result: number[] = [];
      for (let i = 0; i < x.length; i++) {
        const v = x[i];
        if (
          !Number.isInteger(v as number) ||
          (v as number) < 0 ||
          (v as number) > 255
        ) {
          throw new Error(
            `Invalid binary vector element at ${i}: expected integer 0-255, got ${v}`
          );
        }
        result.push(v as number);
      }
      return { value: result, size: byteLen };
    }
  }

  throw new Error(
    `Invalid binary vector: expected Uint8Array, Buffer, base64 string, or array, got ${typeof x}`
  );
}
