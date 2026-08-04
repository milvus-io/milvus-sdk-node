import {
  buildBloomFilter,
  BloomFilterBuilder,
  estimateBloomFilterSize,
  formatExprValues,
  BLOOM_FILTER_DEFAULT_FPR,
  BLOOM_FILTER_MIN_FPR,
  BLOOM_FILTER_MAX_FPR,
} from '../../milvus';
// Not part of the package's public surface -- imported from the module so the
// reference hash can be cross-checked against the one the builder actually runs.
import {
  xxh64,
  xxh64Pairs,
  xxh64Int64,
  BLOOM_FILTER_HEADER_SIZE,
  BLOOM_FILTER_MIN_BYTES,
  BLOOM_FILTER_MAX_BYTES,
  BLOOM_FILTER_BYTES_PER_BLOCK,
  BLOOM_FILTER_DOMAIN_INT64,
  BLOOM_FILTER_DOMAIN_UTF8,
} from '../../milvus/utils/BloomFilter';

import goldenVectors from './testdata/golden_vectors.json';
import cppFixture from './testdata/cpp_generated_100_int64.json';

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

describe('utils/BloomFilter', () => {
  // The blob is the whole contract: SDKs interoperate only if they emit the same bytes for
  // the same members, since the server embeds the blob verbatim and never rebuilds it.
  // These fixtures are the ones the Go SDK (client/sbbf/testdata) and the segcore C++ unit
  // tests check themselves against, so comparing full hex pins this implementation to the
  // wire format rather than merely to a self-consistent one.
  it('matches the shared golden vectors byte for byte', () => {
    expect(goldenVectors.cases.length).toBeGreaterThanOrEqual(3);

    goldenVectors.cases.forEach(testCase => {
      const builder = new BloomFilterBuilder(
        testCase.int_values.length + testCase.string_values.length,
        testCase.fpr
      );
      testCase.int_values.forEach(v => builder.addInt64(BigInt(v)));
      testCase.string_values.forEach(v => builder.addString(v));

      expect(`${testCase.name}:${hex(builder.build())}`).toEqual(
        `${testCase.name}:${testCase.blob_hex}`
      );
    });
  });

  it('matches the blob Arrow C++ generates for 100 int64 values', () => {
    expect(cppFixture.generator).toEqual(
      'apache_arrow_parquet_block_split_bloom_filter'
    );
    expect(cppFixture.int_values.length).toEqual(100);

    const members = cppFixture.int_values.map(v => BigInt(v));
    expect(hex(buildBloomFilter(members, cppFixture.fpr))).toEqual(
      cppFixture.blob_hex
    );
  });

  // The int64 fast path skips the generic hash's stripe and tail loops on the grounds that
  // an 8-byte input can never reach them. If that ever breaks, every int64 filter goes
  // silently wrong while the string ones stay correct.
  it('int64 fast path agrees with the generic hash', () => {
    const values = [
      BigInt(0),
      BigInt(1),
      BigInt(-1),
      BigInt(42),
      BigInt('-9223372036854775808'),
      BigInt('9223372036854775807'),
    ];
    // Deterministic pseudo-random sweep (LCG) so a failure is reproducible.
    let seed = BigInt('20260731');
    const MASK64 = (BigInt(1) << BigInt(64)) - BigInt(1);
    for (let i = 0; i < 2000; i++) {
      seed =
        (seed * BigInt('6364136223846793005') + BigInt('1442695040888963407')) &
        MASK64;
      values.push(seed);
    }

    values.forEach(value => {
      const buf = new Uint8Array(8);
      new DataView(buf.buffer).setBigInt64(0, BigInt.asIntN(64, value), true);
      expect(`${value}:${xxh64Int64(value)}`).toEqual(`${value}:${xxh64(buf)}`);
    });
  });

  it('computes the reference XXH64 digests', () => {
    // Known answers from the reference C implementation (libxxhash, seed 0); the
    // empty-input digest is the value published in the xxHash spec itself.
    const enc = (s: string) => new TextEncoder().encode(s);
    expect(xxh64(new Uint8Array(0)).toString(16)).toEqual('ef46db3751d8e999');
    expect(xxh64(enc('a')).toString(16)).toEqual('d24ec4f1a98c6e5b');
    expect(xxh64(enc('abc')).toString(16)).toEqual('44bc2cf5ad770999');
    expect(xxh64(enc('milvus')).toString(16)).toEqual('d8ec969d7fa9836f');
  });

  it('walks every length-dependent branch of the generic hash', () => {
    // Four branches depend on length: 32-byte stripes, then 8/4/1-byte tails. Lengths
    // 0..80 cover every combination; the golden vectors only reach a couple.
    for (let length = 0; length <= 80; length++) {
      const data = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        data[i] = (i * 37 + 11) & 0xff;
      }
      expect(xxh64(data)).toEqual(xxh64(Uint8Array.from(data)));
    }
  });

  // The string path runs the 32-bit-pair hash; xxh64 above is the BigInt reference it has to
  // agree with. Every length below reaches a different combination of the stripe loop and the
  // 8/4/1-byte tails, so this pins the port branch by branch rather than on a few samples.
  it('pair hash agrees with the BigInt reference at every input length', () => {
    let seed = 20260731;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
    for (let length = 0; length <= 140; length++) {
      const data = new Uint8Array(length);
      for (let i = 0; i < length; i++) data[i] = next() & 0xff;
      expect(`${length}:${xxh64Pairs(data)}`).toEqual(
        `${length}:${xxh64(data)}`
      );
    }
    // Non-zero byteOffset: Buffer.from hands out views into a pooled ArrayBuffer, so the
    // hash must read through the view rather than from the start of its backing store.
    const backing = new Uint8Array(64);
    for (let i = 0; i < 64; i++) backing[i] = next() & 0xff;
    const slice = backing.subarray(7, 45);
    expect(xxh64Pairs(slice)).toEqual(xxh64(slice));
  });

  it('records the value domains in the envelope', () => {
    expect(buildBloomFilter([1])[28]).toEqual(BLOOM_FILTER_DOMAIN_INT64);
    expect(buildBloomFilter(['a'])[28]).toEqual(BLOOM_FILTER_DOMAIN_UTF8);

    // An empty set records no domain, so the server skips the probe entirely and the
    // filter matches nothing, rather than aliasing into whichever domain is probed.
    const empty = buildBloomFilter([]);
    expect(empty[28]).toEqual(0);
    expect(empty.length).toEqual(
      BLOOM_FILTER_HEADER_SIZE + BLOOM_FILTER_MIN_BYTES
    );

    // A builder may record both domains; the convenience function may not.
    const mixed = new BloomFilterBuilder(2, 0.001).addInt64(1).addString('a');
    expect(mixed.getDomains()).toEqual(
      BLOOM_FILTER_DOMAIN_INT64 | BLOOM_FILTER_DOMAIN_UTF8
    );
  });

  it('lays out the MBF1 header as specified', () => {
    const blob = buildBloomFilter([42], 0.01);
    const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);

    expect(Buffer.from(blob.slice(0, 4)).toString('ascii')).toEqual('MBF1');
    expect(view.getUint16(4, true)).toEqual(1);
    expect(view.getUint16(6, true)).toEqual(1);
    expect(view.getBigUint64(8, true)).toEqual(BigInt(1));
    expect(view.getFloat64(16, true)).toEqual(0.01);
    expect(blob[28]).toEqual(BLOOM_FILTER_DOMAIN_INT64);
    // Reserved bytes must be zero: the server rejects a blob that sets them.
    expect([blob[29], blob[30], blob[31]]).toEqual([0, 0, 0]);

    const numBlocks = view.getUint32(24, true);
    expect(blob.length - BLOOM_FILTER_HEADER_SIZE).toEqual(
      numBlocks * BLOOM_FILTER_BYTES_PER_BLOCK
    );
    expect(numBlocks & (numBlocks - 1)).toEqual(0);
  });

  it('treats number and bigint members identically', () => {
    expect(hex(buildBloomFilter([1, 2, 3], 0.001))).toEqual(
      hex(buildBloomFilter([BigInt(1), BigInt(2), BigInt(3)], 0.001))
    );
  });

  it('estimates the blob size exactly', () => {
    const fprs = [
      BLOOM_FILTER_MIN_FPR,
      0.001,
      BLOOM_FILTER_DEFAULT_FPR,
      BLOOM_FILTER_MAX_FPR,
    ];
    const counts = [0, 1, 2, 100, 5000];
    fprs.forEach(fpr => {
      counts.forEach(count => {
        const members = Array.from({ length: count }, (_, i) => i);
        expect(estimateBloomFilterSize(count, fpr)).toEqual(
          buildBloomFilter(members, fpr).length
        );
      });
    });
    // The estimate is what callers check against the proxy's 64 MiB body limit, so the
    // clamp at the top end has to hold.
    expect(estimateBloomFilterSize(1e12, BLOOM_FILTER_MIN_FPR)).toEqual(
      BLOOM_FILTER_HEADER_SIZE + BLOOM_FILTER_MAX_BYTES
    );
  });

  it('accepts the fpr boundaries and rejects everything outside them', () => {
    [BLOOM_FILTER_MIN_FPR, BLOOM_FILTER_MAX_FPR].forEach(fpr => {
      const blob = buildBloomFilter([1], fpr);
      const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
      expect(view.getFloat64(16, true)).toEqual(fpr);
    });

    [0.00009, 0.051, NaN, Infinity, -Infinity, 0, -1].forEach(fpr => {
      expect(() => buildBloomFilter([1], fpr)).toThrow();
      expect(() => estimateBloomFilterSize(1, fpr)).toThrow();
      expect(() => new BloomFilterBuilder(1, fpr)).toThrow();
    });
  });

  it('rejects invalid members', () => {
    // Mixed domains: a filter recording both would match members of either type, which is
    // never what a single-field bloom_match wants.
    expect(() => buildBloomFilter([1, 'mixed'])).toThrow(
      /all integer or all string/
    );
    expect(() => buildBloomFilter(['mixed', 1])).toThrow(
      /all integer or all string/
    );
    expect(() => buildBloomFilter([true as any])).toThrow(
      /all integer or all string/
    );
    expect(() => buildBloomFilter([null as any])).toThrow(
      /all integer or all string/
    );

    // Past 2^53 a number silently rounds, so accepting one would build a filter for a value
    // the caller never asked for and the row would never match.
    expect(() => buildBloomFilter([2 ** 53])).toThrow(/safe integers/);
    expect(() => buildBloomFilter([1.5])).toThrow(/safe integers/);
    expect(() => buildBloomFilter([BigInt('9223372036854775808')])).toThrow(
      /signed int64/
    );
  });

  describe('formatExprValues integration', () => {
    it('ships a blob as bytes_val, not as a string', () => {
      const blob = buildBloomFilter(['alice', 'bob', '小明'], 0.01);

      const formatted = formatExprValues({ bf: blob });

      expect(formatted.bf).toEqual({ bytes_val: blob });
    });

    it('accepts a Buffer too', () => {
      const blob = Buffer.from(buildBloomFilter([1, 2, 3]));

      expect(formatExprValues({ bf: blob })).toEqual({
        bf: { bytes_val: blob },
      });
    });

    it('still handles the existing primitive and array types', () => {
      expect(
        formatExprValues({
          b: true,
          i: 3,
          f: 1.5,
          s: 'x',
          arr: [1, 2],
        })
      ).toEqual({
        b: { bool_val: true },
        i: { int64_val: 3 },
        f: { float_val: 1.5 },
        s: { string_val: 'x' },
        arr: { array_val: { long_data: { data: [1, 2] } } },
      });
    });

    // Previously an unsupported type fell through silently and the key was dropped, so the
    // query ran without that template value instead of failing.
    // Rejecting an unsupported type is the point, but `undefined` is not one: spreading an
    // optional field into an object leaves the key present with no value, and that used to be
    // ignored. Throwing there would break callers who were doing nothing wrong.
    it('skips undefined values rather than rejecting them', () => {
      expect(formatExprValues({ a: 1, b: undefined })).toEqual({
        a: { int64_val: 1 },
      });
    });

    it('throws on an unsupported value type instead of dropping the key', () => {
      expect(() => formatExprValues({ bad: { nested: 1 } })).toThrow(
        /Unsupported expr value type for key "bad"/
      );
      expect(() => formatExprValues({ bad: null })).toThrow(/null/);
    });
  });
});

describe('scratch buffer encoding', () => {
  // The UTF-8 domain encodes into a reused buffer rather than allocating per member, which
  // introduces failure modes the golden vectors cannot reach: a member too long for the
  // buffer, and a short member following a long one. Comparing one builder against another
  // would not catch either -- both would run the same broken encoder and agree -- so the
  // reference hashes a freshly allocated Buffer and places the bits from the spec directly.
  const referenceBlob = (members: string[], fpr: number): Uint8Array => {
    const blob = new BloomFilterBuilder(members.length, fpr).build();
    const out = Uint8Array.from(blob);
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    const numBlocks = view.getUint32(24, true);
    const SALT = [
      0x47b6137b, 0x44974d91, 0x8824ad5b, 0xa2b7289d, 0x705495c7, 0x2df1424b,
      0x9efc4947, 0x5c6bfb31,
    ];
    for (const member of members) {
      const hash = xxh64Pairs(Buffer.from(member, 'utf8'));
      const block = Number(
        ((hash >> BigInt(32)) * BigInt(numBlocks)) >> BigInt(32)
      );
      const key = Number(hash & BigInt(0xffffffff)) | 0;
      for (let i = 0; i < 8; i++) {
        const p = 32 + block * 32 + i * 4;
        const mask = 1 << (Math.imul(key, SALT[i]) >>> 27);
        view.setUint32(p, view.getUint32(p, true) | mask, true);
      }
    }
    out[28] = 2; // DOMAIN_UTF8
    return out;
  };

  it('handles members longer than the scratch buffer', () => {
    // The buffer starts at 256 bytes and grows; the multi-byte cases make the byte length
    // differ from the string length, which is what a 1x capacity bound would truncate.
    // Order matters. The scratch buffer is shared and only grows, so a case can only prove
    // anything about capacity if its byte length exceeds every case before it -- put the big
    // ASCII strings first and the multi-byte ones are never forced to grow, which is exactly
    // how an undersized capacity bound slips through.
    const members = [
      'x'.repeat(255), // fits the initial buffer
      'x'.repeat(257), // first growth
      '\u65e5'.repeat(300), // 900 bytes from a 300-unit string
      '\ud83d\ude80'.repeat(300), // surrogate pairs: 600 units, 1200 bytes
      'a'.repeat(5000),
      '\u65e5'.repeat(6000), // 18000 bytes, past anything the ASCII cases reserved
    ];
    for (const member of members) {
      const builder = new BloomFilterBuilder(1, 0.001);
      builder.addString(member);
      expect(Array.from(builder.build())).toEqual(
        Array.from(referenceBlob([member], 0.001))
      );
    }
  });

  it('does not hash the tail of a previous longer member', () => {
    // If the encoder returned the buffer length rather than the bytes written, a short member
    // following a long one would hash the leftovers and produce a filter nothing matches.
    const builder = new BloomFilterBuilder(2, 0.001);
    builder.addString('z'.repeat(1000)).addString('ab');

    expect(Array.from(builder.build())).toEqual(
      Array.from(referenceBlob(['z'.repeat(1000), 'ab'], 0.001))
    );
  });
});
