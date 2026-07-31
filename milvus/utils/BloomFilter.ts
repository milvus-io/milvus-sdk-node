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
  let acc = ((value & MASK64) * PRIME64_2) & MASK64;
  acc = rotl64(acc, 31);
  acc = (acc * PRIME64_1) & MASK64;
  let result = (PRIME64_5 + SHIFT[8]) ^ acc;
  result = (rotl64(result, 27) * PRIME64_1 + PRIME64_4) & MASK64;
  return avalanche(result);
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
 * Coerces a member to the int64 the hash domain expects.
 *
 * A `number` must be a safe integer: beyond 2^53 JavaScript silently rounds, so accepting
 * one would build a filter for a value the caller never asked for and the row would never
 * match. Callers with ids past that range should pass `bigint`.
 */
const toInt64 = (value: number | bigint): bigint => {
  let result: bigint;
  if (typeof value === 'bigint') {
    result = value;
  } else {
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        `bloom filter integer members must be safe integers; ${value} is not exactly representable as a number, pass a bigint instead`
      );
    }
    result = BigInt(value);
  }
  if (result < INT64_MIN || result > INT64_MAX) {
    throw new Error(
      `bloom filter integer members must fit in signed int64, got ${result}`
    );
  }
  return result;
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
    this.nDeclared = n;
    this.fpr = fpr;
  }

  /** Inserts an integer value, hashed as its 8-byte little-endian encoding. */
  addInt64(value: number | bigint): this {
    this.domains |= BLOOM_FILTER_DOMAIN_INT64;
    this.addHash(xxh64Int64(toInt64(value)));
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
    this.addHash(xxh64(Buffer.from(value, 'utf8')));
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
  private addHash(hash: bigint): void {
    const blockIndex = Number(
      ((hash >> SHIFT[32]) * BigInt(this.numBlocks)) >> SHIFT[32]
    );
    const offset =
      BLOOM_FILTER_HEADER_SIZE + blockIndex * BLOOM_FILTER_BYTES_PER_BLOCK;
    const key = Number(hash & MASK32);
    for (let i = 0; i < WORDS_PER_BLOCK; i++) {
      const mask = 1 << (Math.imul(key, SALT[i]) >>> 27);
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
