/**
 * Client-side Split-Block Bloom Filter (SBBF) construction for the
 * `bloom_match(field, {blob})` filter expression.
 *
 * Building the filter on the client and shipping the compact blob lets large membership
 * sets pass the proxy gRPC receive limit, which a raw value list would exceed: 10M int64
 * values are roughly 90 MB as an `in [...]` list but about 14 MB as a bloom filter. The
 * proxy embeds the blob verbatim after validating the envelope and never rebuilds the
 * filter, so these bytes must match what the other SDKs produce exactly.
 *
 * The bit layout is bit-identical to Arrow C++'s `parquet::BlockSplitBloomFilter`, and thus
 * to the parquet-format BloomFilter.md spec, wrapped in the Milvus MBF1 envelope. See
 * `docs/design-docs/design_docs/20260707-bloom-filter-expression.md` in the milvus repo.
 */

/** The 4-byte MBF1 envelope magic. */
export const BLOOM_FILTER_MAGIC = 'MBF1';
/** The MBF1 envelope version implemented here. */
export const BLOOM_FILTER_VERSION = 1;
/** Identifies the parquet SBBF + XXH64 algorithm. */
export const BLOOM_FILTER_ALGO_PARQUET_SBBF_XXH64 = 1;
/** Size in bytes of the MBF1 envelope header. */
export const BLOOM_FILTER_HEADER_SIZE = 32;
/** Size of one SBBF block (parquet-format spec). */
export const BLOOM_FILTER_BYTES_PER_BLOCK = 32;

/** Marks a filter that recorded int64 values (8-byte little-endian hash domain). */
export const BLOOM_FILTER_DOMAIN_INT64 = 1;
/** Marks a filter that recorded string values (raw UTF-8 hash domain). */
export const BLOOM_FILTER_DOMAIN_UTF8 = 2;

/**
 * Minimum / maximum filter body size, mirroring Arrow's
 * BlockSplitBloomFilter::kMinimumBloomFilterBytes / kMaximumBloomFilterBytes.
 */
export const BLOOM_FILTER_MIN_BYTES = 32;
export const BLOOM_FILTER_MAX_BYTES = 128 * 1024 * 1024;

/** Lowest / highest accepted false-positive rate. */
export const BLOOM_FILTER_MIN_FPR = 0.0001;
export const BLOOM_FILTER_MAX_FPR = 0.05;
/**
 * Recommended false-positive rate when a caller has no specific target. Sizing follows the
 * Arrow formula, so a body holds roughly 0.72 members per byte at this rate. Bodies are
 * powers of two, so a member count just past a tier boundary doubles the blob; raising fpr
 * is usually the cheaper fix.
 */
export const BLOOM_FILTER_DEFAULT_FPR = 0.005;

/**
 * The eight odd constants used to derive one bit position per word inside a block. Fixed by
 * the parquet-format spec and mirrored from Arrow C++'s BlockSplitBloomFilter::SALT.
 */
const SALT = [
  0x47b6137b, 0x44974d91, 0x8824ad5b, 0xa2b7289d, 0x705495c7, 0x2df1424b,
  0x9efc4947, 0x5c6bfb31,
];

const WORDS_PER_BLOCK = 8;

/**
 * BigInt shift amounts, precomputed.
 *
 * `tsconfig.json` targets ES2015, where BigInt *literals* (`31n`) are a compile error, so
 * the codebase spells them `BigInt(...)` (see `LOGICAL_BITS` in Format.ts). Converting
 * inside the hot loop would allocate a BigInt per shift, hence the table — `SHIFT[i]` is
 * `BigInt(i)`.
 */
const SHIFT: bigint[] = [];
for (let i = 0; i <= 64; i++) {
  SHIFT.push(BigInt(i));
}

const MASK64 = (SHIFT[1] << SHIFT[64]) - SHIFT[1];
const MASK32 = BigInt(0xffffffff);
const PRIME64_1 = BigInt('11400714785074694791');
const PRIME64_2 = BigInt('14029467366897019727');
const PRIME64_3 = BigInt('1609587929392839161');
const PRIME64_4 = BigInt('9650029242287828579');
const PRIME64_5 = BigInt('2870177450012600261');

const INT64_MIN = BigInt('-9223372036854775808');
const INT64_MAX = BigInt('9223372036854775807');

const rotl64 = (value: bigint, count: number): bigint =>
  ((value << SHIFT[count]) | (value >> SHIFT[64 - count])) & MASK64;

const round64 = (acc: bigint, value: bigint): bigint => {
  acc = (acc + value * PRIME64_2) & MASK64;
  acc = rotl64(acc, 31);
  return (acc * PRIME64_1) & MASK64;
};

const mergeRound64 = (acc: bigint, value: bigint): bigint => {
  acc ^= round64(SHIFT[0], value);
  return (acc * PRIME64_1 + PRIME64_4) & MASK64;
};

const avalanche = (h: bigint): bigint => {
  h ^= h >> SHIFT[33];
  h = (h * PRIME64_2) & MASK64;
  h ^= h >> SHIFT[29];
  h = (h * PRIME64_3) & MASK64;
  return h ^ (h >> SHIFT[32]);
};

/**
 * XXH64 with seed 0 over raw bytes — the hash the SBBF spec mandates.
 *
 * BigInt rather than a 32-bit-pair implementation: JavaScript numbers cannot represent a
 * 64-bit hash, and every intermediate here (multiply, rotate) genuinely needs the full
 * width. Build cost is dominated by this, so the int64 domain gets a specialised path below.
 */
export const xxh64 = (data: Uint8Array): bigint => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const length = data.length;
  let index = 0;
  let result: bigint;

  if (length >= 32) {
    let v1 = (PRIME64_1 + PRIME64_2) & MASK64;
    let v2 = PRIME64_2;
    let v3 = SHIFT[0];
    let v4 = -PRIME64_1 & MASK64;
    const limit = length - 32;
    while (index <= limit) {
      v1 = round64(v1, view.getBigUint64(index, true));
      v2 = round64(v2, view.getBigUint64(index + 8, true));
      v3 = round64(v3, view.getBigUint64(index + 16, true));
      v4 = round64(v4, view.getBigUint64(index + 24, true));
      index += 32;
    }
    result =
      (rotl64(v1, 1) + rotl64(v2, 7) + rotl64(v3, 12) + rotl64(v4, 18)) &
      MASK64;
    result = mergeRound64(result, v1);
    result = mergeRound64(result, v2);
    result = mergeRound64(result, v3);
    result = mergeRound64(result, v4);
  } else {
    result = PRIME64_5;
  }

  result = (result + BigInt(length)) & MASK64;

  while (index + 8 <= length) {
    result ^= round64(SHIFT[0], view.getBigUint64(index, true));
    result = (rotl64(result, 27) * PRIME64_1 + PRIME64_4) & MASK64;
    index += 8;
  }
  if (index + 4 <= length) {
    result ^= (BigInt(view.getUint32(index, true)) * PRIME64_1) & MASK64;
    result = (rotl64(result, 23) * PRIME64_2 + PRIME64_3) & MASK64;
    index += 4;
  }
  while (index < length) {
    result ^= (BigInt(data[index]) * PRIME64_5) & MASK64;
    result = (rotl64(result, 11) * PRIME64_1) & MASK64;
    index += 1;
  }
  return avalanche(result);
};

/**
 * XXH64 over an int64's 8-byte little-endian encoding, without materialising those bytes.
 *
 * Specialisation of {@link xxh64} for the one input length the int64 domain ever produces:
 * the 32-byte stripe loop and the 4-byte / 1-byte tails are unreachable, leaving a single
 * 8-byte lane. `value & MASK64` is exactly the little-endian two's-complement encoding read
 * back as a u64, so the pack/unpack round trip drops out.
 */
export const xxh64Int64 = (value: bigint): bigint => {
  hashInt64Pair(
    Number((value >> SHIFT[32]) & MASK32) | 0,
    Number(value & MASK32) | 0
  );
  return (BigInt(pairHi >>> 0) << SHIFT[32]) | BigInt(pairLo >>> 0);
};

/*
 * 64-bit arithmetic on pairs of 32-bit integers.
 *
 * Every intermediate in XXH64 is a full 64-bit value, and BigInt is the only JavaScript type
 * that holds one -- but V8 heap-allocates each BigInt intermediate, which for a 10M-member
 * filter dominates the build. Splitting each value into two 32-bit halves keeps everything in
 * Smis: the int64 hash drops from 164ns to 27ns per member, and the whole integer build from
 * 2.86s to about 1.5s. The generic byte-string hash above still uses BigInt; converting it is
 * a larger job because of the stripe and tail loops, and it is checked against these results.
 *
 * Results come back in module-level registers rather than a tuple so the hot path allocates
 * nothing at all. Not reentrant, which is fine: a builder is documented as not thread-safe
 * and JavaScript gives us no preemption inside these functions anyway.
 */
let pairHi = 0;
let pairLo = 0;

const P1_HI = 0x9e3779b1 | 0;
const P1_LO = 0x85ebca87 | 0;
const P2_HI = 0xc2b2ae3d | 0;
const P2_LO = 0x27d4eb4f | 0;
const P3_HI = 0x165667b1 | 0;
const P3_LO = 0x9e3779f9 | 0;
const P4_HI = 0x85ebca77 | 0;
const P4_LO = 0xc2b2ae63 | 0;
const P5_HI = 0x27d4eb2f | 0;
const P5_LO = 0x165667c5 | 0;
// PRIME64_5 + 8, the seed the 8-byte lane starts from.
const P5_PLUS8_HI = 0x27d4eb2f | 0;
const P5_PLUS8_LO = 0x165667cd | 0;

/**
 * pair = (ah:al) * (bh:bl), modulo 2^64.
 *
 * The low half is built from 16-bit partial products so every intermediate stays under 2^32
 * and therefore exact as a JS number; the high half only needs the low 32 bits of the two
 * cross terms, which is exactly what Math.imul gives.
 */
const mul64 = (ah: number, al: number, bh: number, bl: number): void => {
  const a0 = al & 0xffff;
  const a1 = al >>> 16;
  const b0 = bl & 0xffff;
  const b1 = bl >>> 16;

  let t = a0 * b0;
  let lo = t & 0xffff;
  let carry = t >>> 16;

  t = a1 * b0 + carry;
  const mid = t & 0xffff;
  carry = t >>> 16;

  t = a0 * b1 + mid;
  lo |= (t & 0xffff) << 16;
  carry += t >>> 16;

  pairHi = ((a1 * b1 + carry) | 0) + Math.imul(ah, bl) + Math.imul(al, bh);
  pairHi = pairHi | 0;
  pairLo = lo | 0;
};

/**
 * XXH64 (seed 0) over an int64's 8-byte little-endian encoding, in the 32-bit-pair domain.
 *
 * Same specialisation as {@link xxh64Int64}: 8 bytes is the only length the integer domain
 * produces, so the stripe loop and both tails are unreachable and one lane remains. Kept
 * honest by a test that replays it against the BigInt generic hash.
 */
const hashInt64Pair = (vh: number, vl: number): void => {
  mul64(vh, vl, P2_HI, P2_LO); // acc = v * PRIME64_2
  let ah = pairHi;
  let al = pairLo;

  const rh = (ah << 31) | (al >>> 1); // acc = rotl64(acc, 31)
  const rl = (al << 31) | (ah >>> 1);

  mul64(rh, rl, P1_HI, P1_LO); // acc *= PRIME64_1
  ah = pairHi;
  al = pairLo;

  let h = (P5_PLUS8_HI ^ ah) | 0; // result = (PRIME64_5 + 8) ^ acc
  let l = (P5_PLUS8_LO ^ al) | 0;

  mul64((h << 27) | (l >>> 5), (l << 27) | (h >>> 5), P1_HI, P1_LO); // rotl64(_, 27) * PRIME64_1
  l = (pairLo + P4_LO) | 0; // + PRIME64_4
  h = (pairHi + P4_HI + (l >>> 0 < pairLo >>> 0 ? 1 : 0)) | 0;

  l = (l ^ (h >>> 1)) | 0; // h ^= h >>> 33
  mul64(h, l, P2_HI, P2_LO); // h *= PRIME64_2
  h = pairHi;
  l = pairLo;

  l = (l ^ ((h << 3) | (l >>> 29))) | 0; // h ^= h >>> 29
  h = (h ^ (h >>> 29)) | 0;
  mul64(h, l, P3_HI, P3_LO); // h *= PRIME64_3
  h = pairHi;
  l = pairLo;

  pairHi = h; // h ^= h >>> 32
  pairLo = (l ^ h) | 0;
};

/** Reads a little-endian uint32, as an int32, straight from the byte array. */
const readU32LE = (d: Uint8Array, i: number): number =>
  d[i] | (d[i + 1] << 8) | (d[i + 2] << 16) | (d[i + 3] << 24) | 0;

/** pair = (ah:al) + (bh:bl), modulo 2^64. */
const add64 = (ah: number, al: number, bh: number, bl: number): void => {
  const lo = (al + bl) | 0;
  pairHi = (ah + bh + (lo >>> 0 < al >>> 0 ? 1 : 0)) | 0;
  pairLo = lo;
};

/** pair = rotl64(acc + value * PRIME64_2, 31) * PRIME64_1 — XXH64's round step. */
const round64Pair = (ah: number, al: number, vh: number, vl: number): void => {
  mul64(vh, vl, P2_HI, P2_LO);
  add64(ah, al, pairHi, pairLo);
  const h = pairHi;
  const l = pairLo;
  mul64((h << 31) | (l >>> 1), (l << 31) | (h >>> 1), P1_HI, P1_LO);
};

/** pair = (acc ^ round64(0, value)) * PRIME64_1 + PRIME64_4 — XXH64's merge step. */
const mergeRound64Pair = (
  ah: number,
  al: number,
  vh: number,
  vl: number
): void => {
  round64Pair(0, 0, vh, vl);
  mul64((ah ^ pairHi) | 0, (al ^ pairLo) | 0, P1_HI, P1_LO);
  add64(pairHi, pairLo, P4_HI, P4_LO);
};

/** pair = avalanche(h:l) — XXH64's final mix. */
const avalanchePair = (h: number, l: number): void => {
  l = (l ^ (h >>> 1)) | 0; // h ^= h >>> 33
  mul64(h, l, P2_HI, P2_LO);
  h = pairHi;
  l = pairLo;
  l = (l ^ ((h << 3) | (l >>> 29))) | 0; // h ^= h >>> 29
  h = (h ^ (h >>> 29)) | 0;
  mul64(h, l, P3_HI, P3_LO);
  pairLo = (pairLo ^ pairHi) | 0; // h ^= h >>> 32
};

/**
 * XXH64 (seed 0) over raw bytes, in the 32-bit-pair domain — the same function {@link xxh64}
 * computes, without the BigInt allocations. Hashing 10M short strings drops from 3.0s to
 * about 0.5s.
 *
 * {@link xxh64} is kept as the reference this is tested against rather than deleted: the two
 * are checked against each other across every input length that reaches a different branch.
 */
const hashBytesPair = (data: Uint8Array, length: number): void => {
  let index = 0;
  let h: number;
  let l: number;

  if (length >= 32) {
    // v1 = PRIME64_1 + PRIME64_2, v2 = PRIME64_2, v3 = 0, v4 = -PRIME64_1
    add64(P1_HI, P1_LO, P2_HI, P2_LO);
    let v1h = pairHi;
    let v1l = pairLo;
    let v2h = P2_HI;
    let v2l = P2_LO;
    let v3h = 0;
    let v3l = 0;
    add64(~P1_HI, ~P1_LO, 0, 1);
    let v4h = pairHi;
    let v4l = pairLo;

    const limit = length - 32;
    while (index <= limit) {
      round64Pair(v1h, v1l, readU32LE(data, index + 4), readU32LE(data, index));
      v1h = pairHi;
      v1l = pairLo;
      round64Pair(
        v2h,
        v2l,
        readU32LE(data, index + 12),
        readU32LE(data, index + 8)
      );
      v2h = pairHi;
      v2l = pairLo;
      round64Pair(
        v3h,
        v3l,
        readU32LE(data, index + 20),
        readU32LE(data, index + 16)
      );
      v3h = pairHi;
      v3l = pairLo;
      round64Pair(
        v4h,
        v4l,
        readU32LE(data, index + 28),
        readU32LE(data, index + 24)
      );
      v4h = pairHi;
      v4l = pairLo;
      index += 32;
    }

    // rotl(v1,1) + rotl(v2,7) + rotl(v3,12) + rotl(v4,18)
    add64(
      (v1h << 1) | (v1l >>> 31),
      (v1l << 1) | (v1h >>> 31),
      (v2h << 7) | (v2l >>> 25),
      (v2l << 7) | (v2h >>> 25)
    );
    add64(
      pairHi,
      pairLo,
      (v3h << 12) | (v3l >>> 20),
      (v3l << 12) | (v3h >>> 20)
    );
    add64(
      pairHi,
      pairLo,
      (v4h << 18) | (v4l >>> 14),
      (v4l << 18) | (v4h >>> 14)
    );

    mergeRound64Pair(pairHi, pairLo, v1h, v1l);
    mergeRound64Pair(pairHi, pairLo, v2h, v2l);
    mergeRound64Pair(pairHi, pairLo, v3h, v3l);
    mergeRound64Pair(pairHi, pairLo, v4h, v4l);
    h = pairHi;
    l = pairLo;
  } else {
    h = P5_HI;
    l = P5_LO;
  }

  add64(h, l, 0, length); // result += length
  h = pairHi;
  l = pairLo;

  while (index + 8 <= length) {
    round64Pair(0, 0, readU32LE(data, index + 4), readU32LE(data, index));
    // result = rotl64(result ^ lane, 27) * PRIME64_1 + PRIME64_4
    const xh = (h ^ pairHi) | 0;
    const xl = (l ^ pairLo) | 0;
    mul64((xh << 27) | (xl >>> 5), (xl << 27) | (xh >>> 5), P1_HI, P1_LO);
    add64(pairHi, pairLo, P4_HI, P4_LO);
    h = pairHi;
    l = pairLo;
    index += 8;
  }
  if (index + 4 <= length) {
    // result ^= uint32 * PRIME64_1, then rotl 23, * PRIME64_2, + PRIME64_3
    mul64(0, readU32LE(data, index), P1_HI, P1_LO);
    const xh = (h ^ pairHi) | 0;
    const xl = (l ^ pairLo) | 0;
    mul64((xh << 23) | (xl >>> 9), (xl << 23) | (xh >>> 9), P2_HI, P2_LO);
    add64(pairHi, pairLo, P3_HI, P3_LO);
    h = pairHi;
    l = pairLo;
    index += 4;
  }
  while (index < length) {
    // result ^= byte * PRIME64_5, then rotl 11, * PRIME64_1
    mul64(0, data[index], P5_HI, P5_LO);
    const xh = (h ^ pairHi) | 0;
    const xl = (l ^ pairLo) | 0;
    mul64((xh << 11) | (xl >>> 21), (xl << 11) | (xh >>> 21), P1_HI, P1_LO);
    h = pairHi;
    l = pairLo;
    index += 1;
  }

  avalanchePair(h, l);
};

/**
 * XXH64 (seed 0) over raw bytes via the 32-bit-pair path, returned as a bigint.
 *
 * This is what {@link BloomFilterBuilder.addString} actually runs; {@link xxh64} is the
 * BigInt reference kept to check it against. Exported so that check can be a test.
 */
export const xxh64Pairs = (data: Uint8Array): bigint => {
  hashBytesPair(data, data.length);
  return (BigInt(pairHi >>> 0) << SHIFT[32]) | BigInt(pairLo >>> 0);
};

/**
 * Scratch buffer the UTF-8 domain encodes into, so inserting a member allocates nothing.
 *
 * `Buffer.from` per member is 10M allocations for a 10M-member filter. Its own cost is real
 * (0.46s against 0.25s for writing into a reused buffer) but the garbage it makes costs more,
 * and it lands on whatever runs next: the block-setting loop measures 0.15s in isolation and
 * roughly ten times that when it follows a `Buffer.from` in the same loop.
 *
 * Grown, never shrunk, and shared across builders — one buffer the size of the longest member
 * ever encoded, rather than one per insert.
 */
let scratch = Buffer.allocUnsafe(256);

/**
 * Encodes `value` into {@link scratch} and returns its byte length.
 *
 * A UTF-16 code unit is at most three UTF-8 bytes — a surrogate pair is two units and four
 * bytes, so 3x the string length is a safe bound — and `Buffer.write` truncates silently
 * rather than throwing, so capacity has to be assured before the write, not checked after.
 */
const encodeIntoScratch = (value: string): number => {
  const needed = value.length * 3;
  if (scratch.length < needed) {
    scratch = Buffer.allocUnsafe(needed);
  }
  return scratch.write(value, 0, 'utf8');
};

/** Splits a member into the 32-bit halves the pair domain works in, validating as it goes. */
const splitInt64 = (value: number | bigint): void => {
  if (typeof value === 'bigint') {
    if (value < INT64_MIN || value > INT64_MAX) {
      throw new Error(
        `bloom filter integer members must fit in signed int64, got ${value}`
      );
    }
    pairHi = Number((value >> SHIFT[32]) & MASK32) | 0;
    pairLo = Number(value & MASK32) | 0;
    return;
  }
  // A safe integer is inside int64 by construction, so the range check the bigint branch
  // needs is subsumed by this one. Past 2^53 a number silently rounds, so accepting one
  // would build a filter for a value the caller never asked for.
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `bloom filter integer members must be safe integers; ${value} is not exactly representable as a number, pass a bigint instead`
    );
  }
  pairHi = Math.floor(value / 4294967296) | 0;
  pairLo = value | 0;
};

/** Returns the smallest power of two greater than or equal to v. */
const nextPowerOfTwo = (v: number): number => {
  v--;
  v |= v >>> 1;
  v |= v >>> 2;
  v |= v >>> 4;
  v |= v >>> 8;
  v |= v >>> 16;
  return v + 1;
};

/**
 * Mirrors Arrow's BlockSplitBloomFilter::OptimalNumOfBytes: m = -8n / ln(1 - fpp^(1/8)),
 * rounded up to the next power of two and clamped to [MIN_BYTES, MAX_BYTES]. The result is
 * always a power of two and a multiple of BYTES_PER_BLOCK.
 */
const optimalNumOfBytes = (ndv: number, fpp: number): number => {
  const minBits = BLOOM_FILTER_MIN_BYTES << 3;
  const maxBits = BLOOM_FILTER_MAX_BYTES << 3;
  const m = (-8.0 * ndv) / Math.log(1.0 - Math.pow(fpp, 1.0 / 8.0));

  let numBits = m < 0 || m > maxBits ? maxBits : Math.trunc(m);
  if (numBits < minBits) {
    numBits = minBits;
  }
  if ((numBits & (numBits - 1)) !== 0) {
    numBits = nextPowerOfTwo(numBits);
  }
  if (numBits > maxBits) {
    numBits = maxBits;
  }
  return numBits >>> 3;
};

const validateFpr = (fpr: number): void => {
  if (
    typeof fpr !== 'number' ||
    !Number.isFinite(fpr) ||
    fpr < BLOOM_FILTER_MIN_FPR ||
    fpr > BLOOM_FILTER_MAX_FPR
  ) {
    throw new Error(
      `bloom filter fpr must be a finite number in [${BLOOM_FILTER_MIN_FPR}, ${BLOOM_FILTER_MAX_FPR}], got ${fpr}`
    );
  }
};

/**
 * Returns the exact byte length {@link buildBloomFilter} would produce for `n` members at
 * the given false-positive rate, without hashing anything.
 *
 * Use it to check a planned filter against the proxy limits before building it: the body
 * must fit `proxy.maxBloomFilterSize` (64 MiB by default) and the whole request must fit
 * `proxy.grpc.serverMaxRecvSize` (128 MiB by default).
 */
export const estimateBloomFilterSize = (n: number, fpr: number): number => {
  validateFpr(fpr);
  return BLOOM_FILTER_HEADER_SIZE + optimalNumOfBytes(n, fpr);
};

/**
 * Incrementally constructs an SBBF and serializes it into an MBF1 envelope.
 *
 * Unlike {@link buildBloomFilter} a builder accepts both value domains, producing a filter
 * that matches integer and string members alike — useful for a JSON path that legitimately
 * holds both.
 */
export class BloomFilterBuilder {
  private readonly buf: Uint8Array;
  private readonly view: DataView;
  private readonly numBlocks: number;
  /** 32 - log2(numBlocks), and numBlocks - 1: together they reduce a hash to a block index. */
  private readonly blockShift: number;
  private readonly blockMask: number;
  private readonly nDeclared: number;
  private readonly fpr: number;
  private domains = 0;

  /**
   * @param n   expected number of distinct members; it only drives sizing, so inserting more
   *            is allowed and simply raises the effective false-positive rate
   * @param fpr false-positive rate, in [BLOOM_FILTER_MIN_FPR, BLOOM_FILTER_MAX_FPR]
   */
  constructor(n: number, fpr: number = BLOOM_FILTER_DEFAULT_FPR) {
    validateFpr(fpr);
    const numBytes = optimalNumOfBytes(n, fpr);
    this.buf = new Uint8Array(BLOOM_FILTER_HEADER_SIZE + numBytes);
    this.view = new DataView(this.buf.buffer);
    this.numBlocks = numBytes / BLOOM_FILTER_BYTES_PER_BLOCK;
    this.blockShift = 32 - Math.log2(this.numBlocks);
    this.blockMask = this.numBlocks - 1;
    this.nDeclared = n;
    this.fpr = fpr;
  }

  /** Inserts an integer value, hashed as its 8-byte little-endian encoding. */
  addInt64(value: number | bigint): this {
    this.domains |= BLOOM_FILTER_DOMAIN_INT64;
    splitInt64(value);
    hashInt64Pair(pairHi, pairLo);
    this.addHash(pairHi, pairLo);
    return this;
  }

  /**
   * Inserts a string value, hashed as its raw UTF-8 bytes.
   *
   * `Buffer.from` rather than `TextEncoder`: over 10M members the encode step alone is 0.41s
   * via Buffer against 1.48s for a hoisted TextEncoder and 1.81s for a per-call one. Buffer
   * is a Uint8Array subclass, and `xxh64` reads through the view's byteOffset, so the pooled
   * backing store Buffer hands out is handled correctly.
   */
  addString(value: string): this {
    this.domains |= BLOOM_FILTER_DOMAIN_UTF8;
    // scratch is read after encodeIntoScratch, never in the same argument list: the encoder
    // may replace the buffer when it has to grow, and an argument evaluated first would be
    // the old one.
    const length = encodeIntoScratch(value);
    hashBytesPair(scratch, length);
    this.addHash(pairHi, pairLo);
    return this;
  }

  /** Returns the value domains inserted so far. Zero means nothing was inserted. */
  getDomains(): number {
    return this.domains;
  }

  /** Returns the number of 32-byte blocks in the filter body. */
  getNumBlocks(): number {
    return this.numBlocks;
  }

  /**
   * Stamps the MBF1 header onto the filter and returns the envelope.
   *
   * The returned array is the builder's own buffer, not a copy, so a filter costs one
   * allocation of its final size rather than a body plus an equal-sized serialization
   * buffer. Treat it as read-only, and copy it if you keep inserting afterwards.
   */
  build(): Uint8Array {
    for (let i = 0; i < 4; i++) {
      this.buf[i] = BLOOM_FILTER_MAGIC.charCodeAt(i);
    }
    this.view.setUint16(4, BLOOM_FILTER_VERSION, true);
    this.view.setUint16(6, BLOOM_FILTER_ALGO_PARQUET_SBBF_XXH64, true);
    this.view.setBigUint64(8, BigInt(this.nDeclared), true);
    this.view.setFloat64(16, this.fpr, true);
    this.view.setUint32(24, this.numBlocks, true);
    this.buf[28] = this.domains;
    // buf[29..31] stays zero (reserved), and the body is already in place.
    return this.buf;
  }

  /**
   * Sets this hash's eight bits directly in the final MBF1 buffer.
   *
   * The block index needs the full 64-bit product, so it stays in BigInt; everything after
   * is 32-bit, where `Math.imul` gives exactly the wrapping multiply the spec wants and
   * `>>> 27` the logical shift.
   */
  private addHash(hashHi: number, hashLo: number): void {
    // Block index is ((hash >>> 32) * numBlocks) >>> 32, and numBlocks is always a power of
    // two -- optimalNumOfBytes rounds the body up to one and a block is 32 bytes -- so that
    // product-and-shift collapses to hi >>> (32 - log2(numBlocks)), one shift instead of a
    // 2^54 product JS numbers cannot hold exactly. The mask covers numBlocks === 1, where the
    // shift count would be 32 and JS shifts modulo 32 leave hi untouched.
    const blockIndex = (hashHi >>> this.blockShift) & this.blockMask;
    const offset =
      BLOOM_FILTER_HEADER_SIZE + blockIndex * BLOOM_FILTER_BYTES_PER_BLOCK;
    for (let i = 0; i < WORDS_PER_BLOCK; i++) {
      const mask = 1 << (Math.imul(hashLo, SALT[i]) >>> 27);
      const p = offset + i * 4;
      this.view.setUint32(p, this.view.getUint32(p, true) | mask, true);
    }
  }
}

/**
 * Builds an MBF1-wrapped Split-Block Bloom Filter over a membership set.
 *
 * Members must be homogeneous: either all integers (`number` or `bigint`) or all strings.
 * An empty list produces a valid blob that records no domain and therefore matches nothing.
 *
 * Build the blob from the same value domain as the target field: integer fields hash int64,
 * VARCHAR fields hash UTF-8. The envelope records which domains were inserted, so a
 * wrong-domain blob is rejected by the proxy with a parameter error rather than silently
 * matching nothing.
 *
 * ```ts
 * const blob = buildBloomFilter(userIds);
 * await client.query({
 *   collection_name: 'docs',
 *   filter: 'bloom_match(user_id, {bf})',
 *   exprValues: { bf: blob },
 * });
 * ```
 *
 * @param members the membership set
 * @param fpr     false-positive rate, in [BLOOM_FILTER_MIN_FPR, BLOOM_FILTER_MAX_FPR]
 */
export const buildBloomFilter = (
  members: Array<number | bigint | string>,
  fpr: number = BLOOM_FILTER_DEFAULT_FPR
): Uint8Array => {
  if (!Array.isArray(members)) {
    throw new Error('bloom filter members must be an array');
  }
  const builder = new BloomFilterBuilder(members.length, fpr);

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    if (typeof member === 'string') {
      builder.addString(member);
    } else if (typeof member === 'number' || typeof member === 'bigint') {
      builder.addInt64(member);
    } else {
      throw new Error(
        `bloom filter members must be all integer or all string, but element ${i} is ${
          member === null ? 'null' : typeof member
        }`
      );
    }
    // Checked per element rather than once at the end so the error names the element that
    // broke homogeneity. A mixed filter is representable in the envelope, and
    // BloomFilterBuilder will build one, but this convenience API keeps the contract the
    // other SDKs use: one list, one domain.
    if (
      builder.getDomains() ===
      (BLOOM_FILTER_DOMAIN_INT64 | BLOOM_FILTER_DOMAIN_UTF8)
    ) {
      throw new Error(
        `bloom filter members must be all integer or all string, but element ${i} changed the value domain`
      );
    }
  }

  return builder.build();
};
