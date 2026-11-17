/** A reproducible data stream; collection names remain independently unique. */
export const TEST_SEED = Number(process.env.MILVUS_TEST_SEED || 20261117);
if (!Number.isInteger(TEST_SEED))
  throw new Error('MILVUS_TEST_SEED must be an integer');

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
export const random = seededRandom(TEST_SEED);
