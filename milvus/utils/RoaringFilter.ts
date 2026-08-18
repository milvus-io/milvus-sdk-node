/**
 * Client-side roaring bitmap construction for the `roaring_match(field, {blob})` filter
 * expression.
 *
 * `roaring_match` is the exact-membership sibling of `bloom_match`: the client compresses the
 * membership set into a roaring bitmap and ships the blob, so a set that would blow past the
 * proxy gRPC receive limit as an `in [...]` list rides the wire in a fraction of the space --
 * and, unlike a bloom filter, with no false positives. Only int64-domain fields are
 * addressable this way, since a roaring bitmap indexes 64-bit keys.
 *
 * The blob is an MRB1 envelope wrapping a *portable* Roaring64 serialization -- the
 * cross-language format CRoaring calls `portable`, which is what segcore decodes. The proxy
 * validates the envelope and embeds the bytes verbatim, so these bytes must match what the
 * other SDKs produce exactly. See milvus-io/milvus#51968 and
 * `docs/design-docs/design_docs/20260714-roaring-exact-membership-expression.md`.
 */

/** The 4-byte MRB1 envelope magic. */
export const ROARING_BITMAP_MAGIC = 'MRB1';
/** The MRB1 envelope version implemented here. */
export const ROARING_BITMAP_VERSION = 1;
/** Identifies the portable Roaring64 body format. */
export const ROARING_BITMAP_FORMAT_PORTABLE_ROARING64 = 1;
/** Size in bytes of the MRB1 envelope header. */
export const ROARING_BITMAP_HEADER_SIZE = 32;

/**
 * Limits the proxy enforces on a decoded blob, checked here so an oversized set fails at the
 * call that built it rather than as a server-side parameter error one request later.
 */
export const ROARING_BITMAP_MAX_HIGH_CONTAINERS = 1 << 18; // 262144
export const ROARING_BITMAP_MAX_DECODED_BYTES = 64 * 1024 * 1024;
export const ROARING_BITMAP_MAX_BODY_BYTES = 128 * 1024 * 1024;

/** Per-container overheads the decoded-size estimate charges, mirroring the server's. */
const HIGH_CONTAINER_OVERHEAD = 128;
const LOW_CONTAINER_OVERHEAD = 64;

/** Portable Roaring32 cookies: the 32-bit one when no container is a run, else the 16-bit one. */
const COOKIE_NO_RUN = 12346;
const COOKIE_RUN = 12347;

/** Largest cardinality still stored as an array of uint16 rather than as a bitmap. */
const ARRAY_MAX_CARDINALITY = 4096;
/** A bitmap container's serialized body: 1024 uint64 words covering the whole 16-bit space. */
const BITMAP_BODY_BYTES = 8192;
/**
 * The *in-memory* size of a bitmap container in the Go reference -- roaring/v2's
 * `bitmapContainerSizeInBytes()`, i.e. `unsafe.Sizeof(bitmapContainer{}) + 65536/8`, which is
 * 32 + 8192 on every 64-bit platform.
 *
 * Deliberately not 8192. It is the reference's run-vs-bitmap tie-break, and reproducing it
 * verbatim is what makes this implementation emit the identical bytes rather than a merely
 * equivalent encoding: comparing against 8192 flips the choice for containers with 2048..2055
 * runs. The `run_bitmap_tiebreak_run` / `run_bitmap_tiebreak_bitmap` golden vectors pin it.
 */
const BITMAP_CONTAINER_IN_MEMORY_BYTES = 32 + BITMAP_BODY_BYTES; // 8224
/**
 * A run-bearing Roaring32 omits the offset header below this many containers and writes it at
 * or above it. A Roaring32 with no run container always writes it.
 */
const RUN_OFFSET_THRESHOLD = 4;

const KIND_ARRAY = 0;
const KIND_BITMAP = 1;
const KIND_RUN = 2;

const SHIFT32 = BigInt(32);
const MASK32 = BigInt(0xffffffff);
const INT64_MIN = BigInt('-9223372036854775808');
const INT64_MAX = BigInt('9223372036854775807');

/** Only the strict decimal form is accepted; `BigInt()` itself also takes hex, whitespace and ''. */
const DECIMAL_INTEGER = /^[+-]?\d+$/;

/**
 * A membership value.
 *
 * `bigint` and decimal `string` are here because an int64 does not survive a JavaScript
 * number: the SDK already carries int64s as strings everywhere else (see Format.ts), and a
 * number past 2^53 is rejected rather than silently rounded into a different key.
 */
export type RoaringBitmapMember = number | bigint | string;

/**
 * A 16-bit container: the values sharing one `key >> 16`, held as their low 16 bits.
 *
 * `runCount` is the number of maximal consecutive runs, which decides the encoding and sizes
 * a run body; the runs themselves are recomputed while writing rather than stored, so a
 * 65536-value container costs one array rather than two.
 */
interface LowContainer {
  key: number;
  /** ascending, distinct, uint16 */
  values: number[];
  kind: number;
  runCount: number;
  bodySize: number;
}

/** One 2^32 bucket: the containers sharing a `key >> 32`, in ascending 16-bit key order. */
interface HighContainer {
  key: number;
  containers: LowContainer[];
  hasRun: boolean;
  /** serialized size of this bucket's Roaring32 blob, excluding the 4-byte high key */
  size: number;
}

/*
 * The 32-bit halves of the member currently being split.
 *
 * Returned in module-level registers rather than a tuple so inserting a member allocates
 * nothing -- the same trick BloomFilter.ts uses, and for the same reason: a 10M-member build
 * is dominated by whatever the per-member path allocates. Not reentrant, which is fine, since
 * a builder is documented as not thread-safe and JavaScript cannot preempt inside these
 * functions anyway.
 */
let keyHi = 0;
let keyLo = 0;

/**
 * Splits a member into the unsigned 32-bit halves of its roaring key, validating as it goes.
 *
 * The mapping is the normative one: sign-extend to int64, then reinterpret the two's-
 * complement bit pattern as uint64 -- `BigInt.asUintN(64, v)`. So `-1` is
 * `0xffffffffffffffff`, never `0xff`, and ordering is on that unsigned key. For a `number`
 * the same reinterpretation falls out of `Math.floor(v / 2^32)` and `v >>> 0`, both of which
 * are exact for any safe integer, so the common path never touches BigInt.
 *
 * @param value the member
 * @param where a description of where it came from, appended to any error message
 */
const splitInt64Key = (value: unknown, where: string): void => {
  if (typeof value === 'number') {
    // A safe integer is inside int64 by construction, so this subsumes the range check the
    // bigint branch needs. Past 2^53 a number silently rounds, so accepting one would put a
    // key in the bitmap that the caller never asked for and the matching row would be missed.
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        `roaring bitmap members must be safe integers${where}; ${value} is not exactly representable as a number, pass a bigint or a decimal string instead`
      );
    }
    keyHi = Math.floor(value / 4294967296) >>> 0;
    keyLo = value >>> 0;
    return;
  }

  let big: bigint;
  if (typeof value === 'bigint') {
    big = value;
  } else if (typeof value === 'string') {
    if (!DECIMAL_INTEGER.test(value)) {
      throw new Error(
        `roaring bitmap string members must be decimal integers${where}, got "${value}"`
      );
    }
    big = BigInt(value);
  } else {
    throw new Error(
      `roaring bitmap members must be signed integers (number, bigint or decimal string)${where}, got ${
        value === null ? 'null' : typeof value
      }`
    );
  }

  if (big < INT64_MIN || big > INT64_MAX) {
    throw new Error(
      `roaring bitmap members must fit in signed int64${where}, got ${big}`
    );
  }
  const unsigned = BigInt.asUintN(64, big);
  keyHi = Number(unsigned >> SHIFT32);
  keyLo = Number(unsigned & MASK32);
};

const compareNumbers = (a: number, b: number): number => a - b;

/** Chooses an encoding for one container and precomputes what its body will cost. */
const decideContainer = (key: number, values: number[]): LowContainer => {
  let runCount = values.length > 0 ? 1 : 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) {
      runCount++;
    }
  }

  const sizeAsRun = 2 + 4 * runCount;
  const sizeAsArray = 2 * values.length;
  const limit = Math.min(BITMAP_CONTAINER_IN_MEMORY_BYTES, sizeAsArray);

  let kind: number;
  let bodySize: number;
  if (sizeAsRun < limit) {
    kind = KIND_RUN;
    bodySize = sizeAsRun;
  } else if (values.length <= ARRAY_MAX_CARDINALITY) {
    kind = KIND_ARRAY;
    bodySize = sizeAsArray;
  } else {
    kind = KIND_BITMAP;
    bodySize = BITMAP_BODY_BYTES;
  }

  return { key, values, kind, runCount, bodySize };
};

/** Serialized size of one bucket's Roaring32 blob, excluding the 4-byte high key. */
const roaring32Size = (containers: LowContainer[], hasRun: boolean): number => {
  const count = containers.length;
  // cookie (+ run bitmap, one bit per container) and the descriptive header
  let size = (hasRun ? 4 + ((count + 7) >> 3) : 8) + 4 * count;
  if (!hasRun || count >= RUN_OFFSET_THRESHOLD) {
    size += 4 * count;
  }
  for (let i = 0; i < count; i++) {
    size += containers[i].bodySize;
  }
  return size;
};

/**
 * Incrementally collects members and serializes them as an MRB1-wrapped roaring bitmap.
 *
 * Use it when the membership set arrives in pieces -- a cursor, a paged API -- so a 10M-member
 * bitmap never has to exist as a 10M-element array first. {@link buildRoaringBitmap} is the
 * one-shot form.
 *
 * The blob is the expensive part and is meant to be reused: build it once and pass the same
 * `Uint8Array` to every query that needs that membership set.
 *
 * ```ts
 * const builder = new RoaringBitmapBuilder();
 * for await (const page of pages) builder.addMany(page.ids);
 * const blob = builder.build();
 * ```
 */
export class RoaringBitmapBuilder {
  /**
   * high key -> (container key -> low 16 bits), populated in insertion order and sorted only
   * at build time.
   *
   * Bucketing on the way in is what keeps BigInt out of the hot path. The normative algorithm
   * sorts uint64 keys, which in JavaScript means either BigInt comparisons or an index sort
   * over 64-bit pairs; splitting first and sorting the 32-bit high keys and the 16-bit values
   * separately is the same total order -- unsigned high key, then container key, then value --
   * with nothing wider than a uint32 ever compared.
   */
  private readonly highs = new Map<number, Map<number, number[]>>();
  /** Last bucket touched. Members usually arrive clustered, so this skips most outer lookups. */
  private lastHighKey = -1;
  private lastHigh: Map<number, number[]> | null = null;

  /** Adds one member. Duplicates are allowed and collapse at build time. */
  add(value: RoaringBitmapMember): this {
    this.insert(value, '');
    return this;
  }

  /** Adds every member of `values`. */
  addMany(values: ReadonlyArray<RoaringBitmapMember>): this {
    if (!Array.isArray(values)) {
      throw new Error('roaring bitmap members must be an array');
    }
    for (let i = 0; i < values.length; i++) {
      this.insert(values[i], ` at element ${i}`);
    }
    return this;
  }

  /**
   * Serializes the current member set into an MRB1 envelope.
   *
   * The builder stays usable afterwards, and building twice from the same members produces
   * the same bytes.
   *
   * @throws if the bitmap exceeds a limit the proxy would reject (see
   *         ROARING_BITMAP_MAX_HIGH_CONTAINERS / _MAX_DECODED_BYTES / _MAX_BODY_BYTES)
   */
  build(): Uint8Array {
    const highs = this.finalize();

    // Every limit is checked before the body is allocated, so an oversized set fails fast
    // rather than after materialising tens of megabytes.
    if (highs.length > ROARING_BITMAP_MAX_HIGH_CONTAINERS) {
      throw new Error(
        `roaring bitmap high-container count ${highs.length} exceeds maximum ${ROARING_BITMAP_MAX_HIGH_CONTAINERS}`
      );
    }

    let bodyLength = 8;
    let lowCount = 0;
    let cardinality = 0;
    for (let i = 0; i < highs.length; i++) {
      const high = highs[i];
      bodyLength += 4 + high.size;
      lowCount += high.containers.length;
      for (let j = 0; j < high.containers.length; j++) {
        cardinality += high.containers[j].values.length;
      }
    }

    if (bodyLength > ROARING_BITMAP_MAX_BODY_BYTES) {
      throw new Error(
        `roaring bitmap body too large: ${bodyLength} exceeds maximum ${ROARING_BITMAP_MAX_BODY_BYTES}`
      );
    }
    const estimated =
      bodyLength +
      highs.length * HIGH_CONTAINER_OVERHEAD +
      lowCount * LOW_CONTAINER_OVERHEAD;
    if (estimated > ROARING_BITMAP_MAX_DECODED_BYTES) {
      throw new Error(
        `roaring bitmap estimated decoded size ${estimated} exceeds maximum ${ROARING_BITMAP_MAX_DECODED_BYTES}`
      );
    }

    return serialize(highs, cardinality, bodyLength);
  }

  private insert(value: RoaringBitmapMember, where: string): void {
    splitInt64Key(value, where);

    let high: Map<number, number[]>;
    if (this.lastHigh !== null && this.lastHighKey === keyHi) {
      high = this.lastHigh;
    } else {
      const existing = this.highs.get(keyHi);
      if (existing === undefined) {
        high = new Map<number, number[]>();
        this.highs.set(keyHi, high);
      } else {
        high = existing;
      }
      this.lastHighKey = keyHi;
      this.lastHigh = high;
    }

    const containerKey = keyLo >>> 16;
    let values = high.get(containerKey);
    if (values === undefined) {
      values = [];
      high.set(containerKey, values);
    }
    values.push(keyLo & 0xffff);
  }

  /** Sorts and deduplicates every bucket, then decides each container's encoding. */
  private finalize(): HighContainer[] {
    const highKeys = Array.from(this.highs.keys()).sort(compareNumbers);
    const out: HighContainer[] = [];

    for (let h = 0; h < highKeys.length; h++) {
      const low = this.highs.get(highKeys[h])!;
      const containerKeys = Array.from(low.keys()).sort(compareNumbers);
      const containers: LowContainer[] = [];
      let hasRun = false;

      for (let c = 0; c < containerKeys.length; c++) {
        const values = low.get(containerKeys[c])!;
        values.sort(compareNumbers);
        // Deduplicate in place: duplicate members are legal input, and the envelope's
        // cardinality is the distinct count. Doing it here keeps build() idempotent.
        let write = 0;
        for (let r = 0; r < values.length; r++) {
          if (r === 0 || values[r] !== values[r - 1]) {
            values[write++] = values[r];
          }
        }
        values.length = write;

        const container = decideContainer(containerKeys[c], values);
        hasRun = hasRun || container.kind === KIND_RUN;
        containers.push(container);
      }

      out.push({
        key: highKeys[h],
        containers,
        hasRun,
        size: roaring32Size(containers, hasRun),
      });
    }

    return out;
  }
}

/** Writes the MRB1 header and the portable Roaring64 body into one exactly-sized buffer. */
const serialize = (
  highs: HighContainer[],
  cardinality: number,
  bodyLength: number
): Uint8Array => {
  const blob = new Uint8Array(ROARING_BITMAP_HEADER_SIZE + bodyLength);
  const view = new DataView(blob.buffer);

  for (let i = 0; i < 4; i++) {
    blob[i] = ROARING_BITMAP_MAGIC.charCodeAt(i);
  }
  view.setUint16(4, ROARING_BITMAP_VERSION, true);
  view.setUint16(6, ROARING_BITMAP_FORMAT_PORTABLE_ROARING64, true);
  view.setBigUint64(8, BigInt(cardinality), true);
  view.setBigUint64(16, BigInt(bodyLength), true);
  // blob[24..32] stays zero (reserved); the server rejects a blob that sets it.

  let p = ROARING_BITMAP_HEADER_SIZE;
  // Little-endian stores straight into the buffer: every field below is a uint16 or uint32,
  // and going through DataView per field is measurably slower on the per-value loops.
  const putU16 = (v: number): void => {
    blob[p] = v & 0xff;
    blob[p + 1] = (v >>> 8) & 0xff;
    p += 2;
  };
  const putU32 = (v: number): void => {
    blob[p] = v & 0xff;
    blob[p + 1] = (v >>> 8) & 0xff;
    blob[p + 2] = (v >>> 16) & 0xff;
    blob[p + 3] = (v >>> 24) & 0xff;
    p += 4;
  };

  // uint64 high_container_count. The count is bounded by 2^18, so the high word is zero.
  putU32(highs.length);
  putU32(0);

  for (let h = 0; h < highs.length; h++) {
    const high = highs[h];
    const containers = high.containers;
    const count = containers.length;
    putU32(high.key);

    const start = p;
    let cookieSize: number;
    let runBitmapSize: number;
    if (high.hasRun) {
      cookieSize = 4;
      runBitmapSize = (count + 7) >> 3;
      putU16(COOKIE_RUN);
      putU16(count - 1);
      // One bit per container, set iff that container is a run. The buffer starts zeroed, so
      // the trailing pad bits are already 0 and only the set bits need writing.
      for (let i = 0; i < count; i++) {
        if (containers[i].kind === KIND_RUN) {
          blob[p + (i >> 3)] |= 1 << (i & 7);
        }
      }
      p += runBitmapSize;
    } else {
      cookieSize = 8;
      runBitmapSize = 0;
      putU32(COOKIE_NO_RUN);
      putU32(count);
    }

    // Descriptive header: container key and cardinality *minus one*, which is how a container
    // holding all 65536 values fits in a uint16.
    for (let i = 0; i < count; i++) {
      putU16(containers[i].key);
      putU16(containers[i].values.length - 1);
    }

    // Offset header: present unless this bucket has a run container and fewer than four
    // containers. Offsets are relative to the start of this Roaring32 blob.
    if (!high.hasRun || count >= RUN_OFFSET_THRESHOLD) {
      let offset = cookieSize + runBitmapSize + 8 * count;
      for (let i = 0; i < count; i++) {
        putU32(offset);
        offset += containers[i].bodySize;
      }
    }

    for (let i = 0; i < count; i++) {
      const container = containers[i];
      const values = container.values;
      if (container.kind === KIND_RUN) {
        putU16(container.runCount);
        for (let v = 0; v < values.length;) {
          const runStart = values[v];
          let end = runStart;
          v++;
          while (v < values.length && values[v] === end + 1) {
            end = values[v];
            v++;
          }
          putU16(runStart);
          putU16(end - runStart); // run length minus one
        }
      } else if (container.kind === KIND_BITMAP) {
        // 1024 little-endian uint64 words, bit `v & 63` of word `v >> 6`. Written a byte at a
        // time because in little-endian that bit is bit `v & 7` of byte `v >> 3` -- the same
        // layout without any 64-bit arithmetic. The buffer starts zeroed, so the clear words
        // need no writing at all.
        for (let v = 0; v < values.length; v++) {
          const value = values[v];
          blob[p + (value >>> 3)] |= 1 << (value & 7);
        }
        p += BITMAP_BODY_BYTES;
      } else {
        for (let v = 0; v < values.length; v++) {
          putU16(values[v]);
        }
      }
    }

    /* istanbul ignore next: a mismatch would mean the size predictor and the writer disagree */
    if (p - start !== high.size) {
      throw new Error(
        `roaring bitmap serialization wrote ${p - start} bytes for high container ${
          high.key
        }, predicted ${high.size}`
      );
    }
  }

  return blob;
};

/**
 * Builds an MRB1-wrapped roaring bitmap over a membership set, for `roaring_match`.
 *
 * Members are signed integers -- `number`, `bigint`, or a decimal `string` for values a
 * number cannot hold exactly. They map by sign extension to int64 and then by two's-
 * complement reinterpretation to the bitmap's unsigned 64-bit key space, so `-1` and
 * `INT8(-1)` are the same key; duplicates collapse and order does not matter. An empty set
 * produces a valid 40-byte blob that matches nothing.
 *
 * The target field must be an int64-domain field: unlike `bloom_match` there is no string
 * form, because a roaring bitmap indexes integers.
 *
 * Building the blob is the expensive part, so keep it and reuse it across queries rather than
 * rebuilding per request.
 *
 * ```ts
 * const blob = buildRoaringBitmap(userIds);
 * await client.query({
 *   collection_name: 'docs',
 *   filter: 'roaring_match(user_id, {ids})',
 *   exprValues: { ids: blob },
 * });
 * ```
 *
 * @param members the membership set
 */
export const buildRoaringBitmap = (
  members: ReadonlyArray<RoaringBitmapMember>
): Uint8Array => {
  if (!Array.isArray(members)) {
    throw new Error('roaring bitmap members must be an array');
  }
  return new RoaringBitmapBuilder().addMany(members).build();
};
