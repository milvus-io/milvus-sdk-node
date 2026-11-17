import path from 'path';
import { createHash } from 'crypto';
import protobuf from 'protobufjs';
import {
  buildRoaringBitmap,
  RoaringBitmapBuilder,
  RoaringBitmapMember,
  formatExprValues,
  buildSearchRequest,
} from '../../milvus';
// Not part of the package's public surface -- imported from the module so the tests can
// assert the MRB1 envelope and the limits by name rather than by magic number.
import {
  ROARING_BITMAP_HEADER_SIZE,
  ROARING_BITMAP_MAX_HIGH_CONTAINERS,
  ROARING_BITMAP_MAX_DECODED_BYTES,
} from '../../milvus/utils/RoaringFilter';

import goldenVectors from './testdata/roaring_golden_vectors.json';

interface MemberRange {
  start: string;
  count: number;
  step: string;
}

interface GoldenCase {
  name: string;
  comment: string;
  members: MemberRange[];
  member_count: number;
  cardinality: number;
  body_length: number;
  high_container_count: number;
  low_container_count: number;
  container_kinds: Record<string, number>;
  blob_base64: string;
  blob_sha256: string;
}

const goldenCases = goldenVectors.cases as GoldenCase[];

/** `start, start+step, ... start+(count-1)*step` for every range, concatenated. */
const expandMembers = (ranges: MemberRange[]): bigint[] => {
  const members: bigint[] = [];
  for (const range of ranges) {
    const step = BigInt(range.step);
    let value = BigInt(range.start);
    for (let i = 0; i < range.count; i++) {
      members.push(value);
      value += step;
    }
  }
  return members;
};

const viewOf = (blob: Uint8Array): DataView =>
  new DataView(blob.buffer, blob.byteOffset, blob.byteLength);

/**
 * Describes a blob against an expectation in a form that pinpoints the first differing byte.
 *
 * A raw `toEqual` on two multi-kilobyte arrays reports thousands of lines and never says
 * which rule is wrong; the offset does, since the layout is positional.
 */
const describeBlob = (blob: Uint8Array, reference: Uint8Array): string => {
  const shared = Math.min(blob.length, reference.length);
  let i = 0;
  while (i < shared && blob[i] === reference[i]) {
    i++;
  }
  if (i === shared && blob.length === reference.length) {
    return `length=${blob.length} firstDiff=none`;
  }
  const at =
    i < shared ? `0x${blob[i].toString(16).padStart(2, '0')}` : '<eof>';
  return `length=${blob.length} firstDiff=${i} byte=${at}`;
};

const describeReference = (reference: Uint8Array): string =>
  `length=${reference.length} firstDiff=none`;

const sha256 = (blob: Uint8Array): string =>
  createHash('sha256').update(blob).digest('hex');

describe('utils/RoaringFilter', () => {
  // The blob is the whole contract: the proxy validates the envelope and then embeds the
  // bytes verbatim, so five independent SDKs interoperate only by emitting the same bytes for
  // the same members. These vectors come from the shipped Go builder
  // (client/roaringfilter.Build), and every one of them has been checked to pass the server's
  // own validator and to decode under CRoaring -- the library segcore probes -- with exact
  // membership. Matching them byte for byte is the conformance signal.
  it('matches the shared golden vectors byte for byte', () => {
    expect(goldenVectors.spec).toEqual('MRB1');
    expect(goldenVectors.version).toEqual(1);
    expect(goldenCases.length).toEqual(29);

    goldenCases.forEach(testCase => {
      const members = expandMembers(testCase.members);
      expect(`${testCase.name}:${members.length}`).toEqual(
        `${testCase.name}:${testCase.member_count}`
      );

      const blob = buildRoaringBitmap(members);
      const reference = new Uint8Array(
        Buffer.from(testCase.blob_base64, 'base64')
      );

      expect(`${testCase.name} ${describeBlob(blob, reference)}`).toEqual(
        `${testCase.name} ${describeReference(reference)}`
      );
      expect(`${testCase.name} ${sha256(blob)}`).toEqual(
        `${testCase.name} ${testCase.blob_sha256}`
      );

      // Redundant with byte equality, but a failure here names the rule that broke rather
      // than an offset: cardinality is the distinct-member count, body_length the envelope's
      // own accounting, and the first body field the number of 2^32 buckets.
      const view = viewOf(blob);
      expect(`${testCase.name} card=${view.getBigUint64(8, true)}`).toEqual(
        `${testCase.name} card=${testCase.cardinality}`
      );
      expect(`${testCase.name} body=${view.getBigUint64(16, true)}`).toEqual(
        `${testCase.name} body=${testCase.body_length}`
      );
      expect(`${testCase.name} highs=${view.getBigUint64(32, true)}`).toEqual(
        `${testCase.name} highs=${testCase.high_container_count}`
      );
    });
  });

  describe('signed integer mapping', () => {
    /**
     * Reads back the single 64-bit key a one-member blob encodes, as hex.
     *
     * A one-member container is always an array (a run would cost 6 bytes against 2), so the
     * layout is fixed: 8-byte high-container count, 4-byte high key, the 32-bit cookie, the
     * container count, one descriptor, one offset, then the value.
     */
    const keyOf = (member: RoaringBitmapMember): string => {
      const blob = buildRoaringBitmap([member]);
      const view = viewOf(blob);
      expect(view.getBigUint64(32, true)).toEqual(BigInt(1)); // one high container
      expect(view.getUint32(44, true)).toEqual(12346); // the no-run cookie
      expect(view.getUint32(48, true)).toEqual(1); // one 16-bit container
      expect(view.getUint16(54, true)).toEqual(0); // cardinality - 1

      const key =
        (BigInt(view.getUint32(40, true)) << BigInt(32)) |
        (BigInt(view.getUint16(52, true)) << BigInt(16)) |
        BigInt(view.getUint16(60, true));
      return key.toString(16).padStart(16, '0');
    };

    // Sign-extend to int64, then reinterpret the two's-complement bits as uint64. The wrong
    // mappings this rules out are zero-extension of a narrow value (INT8(-1) -> 0xff), zigzag,
    // and biasing by 2^63.
    it('reinterprets the two’s-complement bits as an unsigned key', () => {
      const table: Array<[string, string]> = [
        ['-9223372036854775808', '8000000000000000'], // INT64_MIN
        ['-2147483648', 'ffffffff80000000'], // INT32_MIN
        ['-32768', 'ffffffffffff8000'], // INT16_MIN
        ['-128', 'ffffffffffffff80'], // INT8_MIN
        ['-1', 'ffffffffffffffff'],
        ['0', '0000000000000000'],
        ['1', '0000000000000001'],
        ['42', '000000000000002a'],
        ['127', '000000000000007f'],
        ['2147483647', '000000007fffffff'],
        ['9223372036854775807', '7fffffffffffffff'], // INT64_MAX
      ];

      table.forEach(([member, expected]) => {
        expect(`${member} -> ${keyOf(BigInt(member))}`).toEqual(
          `${member} -> ${expected}`
        );
      });
    });

    // The same value arriving from a narrow signed column is the same key: an INT8 -1 is
    // sign-extended, never zero-extended, so it cannot land at 0x00000000000000ff.
    it('puts a narrow negative value in the top high container', () => {
      [-1, -128, -32768, -2147483648].forEach(member => {
        expect(`${member}:${keyOf(member).slice(0, 8)}`).toEqual(
          `${member}:ffffffff`
        );
      });
    });

    // Unsigned ordering, not signed: {-1, 5} serializes as {5, 0xffff...}, so the negative
    // member lands in the *last* high container, not the first.
    it('orders on the unsigned key', () => {
      const blob = buildRoaringBitmap([-1, 5]);
      const view = viewOf(blob);
      expect(view.getBigUint64(32, true)).toEqual(BigInt(2));
      // First bucket is 5's (high key 0), so a signed sort would have put 0xffffffff here.
      expect(view.getUint32(40, true)).toEqual(0);
    });
  });

  it('treats number, bigint and decimal string members identically', () => {
    // Every value here is a safe integer, which is the only kind a `number` may carry.
    const members = [-4294967297, -65537, -1, 0, 1, 42, 65537, 4294967297];
    const asNumbers = buildRoaringBitmap(members);
    const asBigInts = buildRoaringBitmap(members.map(m => BigInt(m)));
    const asStrings = buildRoaringBitmap(members.map(m => String(m)));

    expect(Array.from(asBigInts)).toEqual(Array.from(asNumbers));
    expect(Array.from(asStrings)).toEqual(Array.from(asNumbers));

    // The values a number cannot hold exactly are exactly the ones that must go through a
    // bigint or a string, so check the two agree there too.
    expect(
      Array.from(buildRoaringBitmap([BigInt('9223372036854775807')]))
    ).toEqual(Array.from(buildRoaringBitmap(['9223372036854775807'])));
  });

  it('collapses duplicates and ignores input order', () => {
    const canonical = buildRoaringBitmap([-1, 0, 5]);

    expect(Array.from(buildRoaringBitmap([5, 5, 5, -1, -1, 0, 5]))).toEqual(
      Array.from(canonical)
    );
    expect(Array.from(buildRoaringBitmap([5, -1, 0]))).toEqual(
      Array.from(canonical)
    );
    // Cardinality is the distinct count, not the member count.
    expect(viewOf(canonical).getBigUint64(8, true)).toEqual(BigInt(3));
  });

  it('builds a valid empty bitmap', () => {
    const blob = buildRoaringBitmap([]);

    expect(blob.length).toEqual(ROARING_BITMAP_HEADER_SIZE + 8);
    expect(Buffer.from(blob.slice(0, 4)).toString('ascii')).toEqual('MRB1');
    const view = viewOf(blob);
    expect(view.getUint16(4, true)).toEqual(1); // version
    expect(view.getUint16(6, true)).toEqual(1); // portable_roaring64
    expect(view.getBigUint64(8, true)).toEqual(BigInt(0)); // cardinality
    // A body of eight zero bytes: high_container_count = 0. Never a body_length of 0.
    expect(view.getBigUint64(16, true)).toEqual(BigInt(8));
    expect(view.getBigUint64(32, true)).toEqual(BigInt(0));
    // Reserved bytes must be zero: the server rejects a blob that sets them.
    expect(Array.from(blob.slice(24, 32))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('lays out the MRB1 header as specified', () => {
    const blob = buildRoaringBitmap([1, 2, 3]);
    const view = viewOf(blob);

    expect(Buffer.from(blob.slice(0, 4)).toString('ascii')).toEqual('MRB1');
    expect(view.getUint16(4, true)).toEqual(1);
    expect(view.getUint16(6, true)).toEqual(1);
    expect(view.getBigUint64(8, true)).toEqual(BigInt(3));
    expect(Number(view.getBigUint64(16, true))).toEqual(
      blob.length - ROARING_BITMAP_HEADER_SIZE
    );
    expect(Array.from(blob.slice(24, 32))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  describe('RoaringBitmapBuilder', () => {
    it('agrees with the one-shot builder', () => {
      const members = [
        '-9223372036854775808',
        '-1',
        '0',
        '1',
        '65535',
        '65536',
      ];
      const builder = new RoaringBitmapBuilder();
      members.forEach(m => builder.add(m));

      expect(Array.from(builder.build())).toEqual(
        Array.from(buildRoaringBitmap(members))
      );
    });

    it('builds the same bytes every time', () => {
      // Sorting and dedup happen at build time and mutate the builder's own buckets, so a
      // second build has to be idempotent rather than seeing half-processed state.
      const builder = new RoaringBitmapBuilder().addMany([3, 1, 2, 1, 3]);
      const first = builder.build();
      const second = builder.build();

      expect(Array.from(second)).toEqual(Array.from(first));
      expect(Array.from(first)).toEqual(
        Array.from(buildRoaringBitmap([1, 2, 3]))
      );
    });

    it('keeps accepting members after a build', () => {
      const builder = new RoaringBitmapBuilder().addMany([1, 2]);
      builder.build();
      builder.add(3);

      expect(Array.from(builder.build())).toEqual(
        Array.from(buildRoaringBitmap([1, 2, 3]))
      );
    });
  });

  describe('limits', () => {
    // One member per 2^32 bucket, so the member count is the high-container count.
    const oneMemberPerHighContainer = (count: number): number[] =>
      Array.from({ length: count }, (_, i) => i * 4294967296);

    it('accepts exactly the maximum number of high containers', () => {
      const blob = buildRoaringBitmap(
        oneMemberPerHighContainer(ROARING_BITMAP_MAX_HIGH_CONTAINERS)
      );
      expect(viewOf(blob).getBigUint64(32, true)).toEqual(
        BigInt(ROARING_BITMAP_MAX_HIGH_CONTAINERS)
      );
    });

    it('rejects one high container too many', () => {
      expect(() =>
        buildRoaringBitmap(
          oneMemberPerHighContainer(ROARING_BITMAP_MAX_HIGH_CONTAINERS + 1)
        )
      ).toThrow(/high-container count 262145 exceeds maximum 262144/);
    });

    it('rejects a bitmap whose estimated decoded size is too large', () => {
      // The estimate charges 128 bytes per high container and 64 per 16-bit container, so the
      // cheapest way to exceed 64 MiB is the maximum number of high containers with two
      // 16-bit containers each -- 8.4 MB of body, but 67 MB of per-container overhead.
      const members: number[] = [];
      for (let i = 0; i < ROARING_BITMAP_MAX_HIGH_CONTAINERS; i++) {
        members.push(i * 4294967296, i * 4294967296 + 65536);
      }

      expect(() => buildRoaringBitmap(members)).toThrow(
        new RegExp(
          `estimated decoded size \\d+ exceeds maximum ${ROARING_BITMAP_MAX_DECODED_BYTES}`
        )
      );
    });
  });

  it('rejects invalid members', () => {
    // Past 2^53 a number silently rounds, so accepting one would put a key in the bitmap the
    // caller never asked for and the row it was meant to match would be missed.
    expect(() => buildRoaringBitmap([2 ** 53])).toThrow(/safe integers/);
    expect(() => buildRoaringBitmap([1.5])).toThrow(/safe integers/);
    expect(() => buildRoaringBitmap([NaN])).toThrow(/safe integers/);
    expect(() => buildRoaringBitmap([Infinity])).toThrow(/safe integers/);

    expect(() => buildRoaringBitmap([BigInt('9223372036854775808')])).toThrow(
      /signed int64/
    );
    expect(() => buildRoaringBitmap([BigInt('-9223372036854775809')])).toThrow(
      /signed int64/
    );
    expect(() => buildRoaringBitmap(['9223372036854775808'])).toThrow(
      /signed int64/
    );

    expect(() => buildRoaringBitmap(['1.5'])).toThrow(/decimal integers/);
    expect(() => buildRoaringBitmap(['abc'])).toThrow(/decimal integers/);
    expect(() => buildRoaringBitmap([''])).toThrow(/decimal integers/);
    expect(() => buildRoaringBitmap(['0x10'])).toThrow(/decimal integers/);

    // A roaring bitmap indexes integers: there is no string, float or boolean domain the way
    // bloom_match has one.
    expect(() => buildRoaringBitmap([true as any])).toThrow(/signed integers/);
    expect(() => buildRoaringBitmap([null as any])).toThrow(/null/);
    expect(() => buildRoaringBitmap([undefined as any])).toThrow(
      /signed integers/
    );
    expect(() => buildRoaringBitmap([{} as any])).toThrow(/signed integers/);
    expect(() => buildRoaringBitmap('123' as any)).toThrow(/must be an array/);

    // The message names the offending element, since a bad member in a 10M-element list is
    // otherwise unfindable.
    expect(() => buildRoaringBitmap([1, 2, 1.5])).toThrow(/at element 2/);
  });

  describe('template plumbing', () => {
    // roaring_match takes only a {template} placeholder resolving to protobuf bytes, so the
    // blob has to reach TemplateValue.bytes_val -- not a string, not base64.
    it('ships a blob as bytes_val', () => {
      const blob = buildRoaringBitmap([1, 2, 3]);

      expect(formatExprValues({ ids: blob })).toEqual({
        ids: { bytes_val: blob },
      });
    });

    it('accepts a Buffer too', () => {
      const blob = Buffer.from(buildRoaringBitmap([1, 2, 3]));

      expect(formatExprValues({ ids: blob })).toEqual({
        ids: { bytes_val: blob },
      });
    });

    describe('through buildSearchRequest', () => {
      const milvusProto = protobuf.loadSync(
        path.resolve(__dirname, '../../proto/proto/milvus.proto')
      );

      const describeCollectionResponse = {
        status: { error_code: 'Success', reason: '' },
        collection_name: 'test',
        collectionID: 0,
        consistency_level: 'Session',
        num_partitions: '0',
        aliases: [],
        virtual_channel_names: {},
        physical_channel_names: {},
        start_positions: [],
        shards_num: 1,
        created_timestamp: '0',
        created_utc_timestamp: '0',
        properties: [],
        db_name: '',
        schema: {
          name: 'test',
          description: '',
          enable_dynamic_field: false,
          autoID: false,
          fields: [
            {
              name: 'id',
              fieldID: '1',
              dataType: 5,
              is_primary_key: true,
              description: 'id field',
              data_type: 'Int64',
              type_params: [],
              index_params: [],
            },
            {
              name: 'vector',
              fieldID: '2',
              dataType: 101,
              is_primary_key: false,
              description: 'vector field',
              data_type: 'FloatVector',
              type_params: [{ key: 'dim', value: '3' }],
              index_params: [],
            },
            {
              name: 'vector2',
              fieldID: '3',
              dataType: 101,
              is_primary_key: false,
              description: 'second vector field',
              data_type: 'FloatVector',
              type_params: [{ key: 'dim', value: '3' }],
              index_params: [],
            },
          ],
        },
        anns_fields: {
          vector: {
            data_type: 'FloatVector',
            dataType: 101,
            type_params: [{ key: 'dim', value: '3' }],
            index_params: [],
          },
          vector2: {
            data_type: 'FloatVector',
            dataType: 101,
            type_params: [{ key: 'dim', value: '3' }],
            index_params: [],
          },
        },
      } as any;

      it('carries the blob into a search request', () => {
        const blob = buildRoaringBitmap([1, 2, 3]);

        const result = buildSearchRequest(
          {
            collection_name: 'test',
            data: [[1, 2, 3]],
            expr: 'roaring_match(id, {ids})',
            exprValues: { ids: blob },
          },
          describeCollectionResponse,
          milvusProto
        );

        expect(result.isHybridSearch).toEqual(false);
        expect((result.request as any).expr_template_values).toEqual({
          ids: { bytes_val: blob },
        });
      });

      it('carries the blob into every sub-request of a hybrid search', () => {
        const blob = buildRoaringBitmap([1, 2, 3]);

        const result = buildSearchRequest(
          {
            collection_name: 'test',
            limit: 1,
            data: [
              {
                data: [1, 2, 3],
                anns_field: 'vector',
                exprValues: { ids: blob },
              },
              {
                data: [4, 5, 6],
                anns_field: 'vector2',
                exprValues: { ids: blob },
              },
            ],
            expr: 'roaring_match(id, {ids})',
          },
          describeCollectionResponse,
          milvusProto
        );

        expect(result.isHybridSearch).toEqual(true);
        result.request.requests!.forEach(request => {
          expect((request as any).expr_template_values).toEqual({
            ids: { bytes_val: blob },
          });
        });
      });
    });
  });
});
