import {
  RrfHybridFuser,
  StreamCursor,
  FetchBatch,
  FusionItem,
  FusionPk,
} from '../../milvus';
import { Data } from '../../milvus/grpc/Data';

/**
 * Unit tests for the client-side hybrid searchIterator RRF fusion (PR 6b) --
 * the TypeScript port of pymilvus's _RrfHybridFuser. These exercise the NRA/RRF
 * fuser and the hybridSearchIterator output_fields passthrough over mock
 * streams / a fake client -- no live milvus.
 */

const K = 60;

// a () -> Promise<FusionItem[]> batch source serving `items` in fixed batches
function makeSource(items: FusionItem[], batchSize = 4): FetchBatch {
  const batches: FusionItem[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  let idx = 0;
  return async () => (idx < batches.length ? batches[idx++] : []);
}

// brute-force RRF: score(d) = sum over streams where d appears of 1/(k+rank)
function referenceRrf(
  streams: FusionItem[][],
  k: number
): Map<FusionPk, number> {
  const ranks = new Map<FusionPk, Map<number, number>>();
  streams.forEach((stream, si) => {
    stream.forEach(([doc], i) => {
      if (!ranks.has(doc)) ranks.set(doc, new Map());
      ranks.get(doc)!.set(si, i + 1);
    });
  });
  const score = new Map<FusionPk, number>();
  for (const [doc, byStream] of ranks) {
    let s = 0;
    for (const r of byStream.values()) s += 1 / (k + r);
    score.set(doc, s);
  }
  return score;
}

async function drain(
  fuser: RrfHybridFuser,
  batchSize: number
): Promise<FusionItem[]> {
  const out: FusionItem[] = [];
  for (;;) {
    const batch = await fuser.nextBatch(batchSize);
    if (batch.length === 0) break;
    out.push(...batch);
  }
  return out;
}

// `fused` is a correct RRF fusion of `streams`: complete, deduplicated, emitted
// in true-RRF-descending order, each emitted score a (non-increasing) lower
// bound on the true RRF score. See RrfHybridFuser -- the NRA emission rule.
function assertValidRrf(
  fused: FusionItem[],
  streams: FusionItem[][],
  k: number
) {
  const ref = referenceRrf(streams, k);
  const ids = fused.map(([d]) => d);
  expect(ids.length).toBe(new Set(ids).size); // no duplicate
  expect(new Set(ids)).toEqual(new Set(ref.keys())); // complete

  const trueSeq = fused.map(([d]) => ref.get(d)!);
  for (let i = 1; i < trueSeq.length; i++) {
    expect(trueSeq[i - 1]).toBeGreaterThanOrEqual(trueSeq[i] - 1e-9);
  }
  const emitted = fused.map(([, s]) => s);
  for (let i = 1; i < emitted.length; i++) {
    expect(emitted[i - 1]).toBeGreaterThanOrEqual(emitted[i] - 1e-9);
  }
  for (const [d, s] of fused) {
    expect(s).toBeLessThanOrEqual(ref.get(d)! + 1e-9);
  }
}

describe('RrfHybridFuser', () => {
  it('fuses disjoint streams', async () => {
    const s0: FusionItem[] = Array.from({ length: 10 }, (_, i) => [
      `a${i}`,
      1 - i * 0.01,
    ]);
    const s1: FusionItem[] = Array.from({ length: 10 }, (_, i) => [
      `b${i}`,
      1 - i * 0.01,
    ]);
    const fuser = new RrfHybridFuser([makeSource(s0), makeSource(s1)], K);
    assertValidRrf(await drain(fuser, 5), [s0, s1], K);
  });

  it('sums both ranks for an overlapping doc', async () => {
    // "x" is rank 1 in s0 and rank 1 in s1 -> highest RRF (2/(K+1))
    const s0: FusionItem[] = [
      ['x', 0.9],
      ['a', 0.8],
      ['b', 0.7],
    ];
    const s1: FusionItem[] = [
      ['x', 0.5],
      ['c', 0.4],
      ['d', 0.3],
    ];
    const fuser = new RrfHybridFuser([makeSource(s0), makeSource(s1)], K);
    const fused = await drain(fuser, 10);
    assertValidRrf(fused, [s0, s1], K);
    expect(fused[0][0]).toBe('x');
    expect(fused[0][1]).toBeCloseTo(2 / (K + 1), 9);
  });

  it('handles full overlap with reversed orders', async () => {
    const s0: FusionItem[] = Array.from({ length: 8 }, (_, i) => [
      `d${i}`,
      1 - i * 0.1,
    ]);
    const s1: FusionItem[] = [...s0].reverse();
    const fuser = new RrfHybridFuser([makeSource(s0), makeSource(s1)], K);
    const fused = await drain(fuser, 3);
    assertValidRrf(fused, [s0, s1], K);
    expect(fused.length).toBe(8);
  });

  it('emits a deep skewed shared doc exactly once', async () => {
    // `shared` settles from its rank-1 sighting in the single-item stream s0
    // long before the deep stream s1 reaches it at rank 51 -- the resurfacing
    // must not re-emit it (the emitted-set guard).
    const shared = 'shared';
    const s0: FusionItem[] = [[shared, 1.0]];
    const s1: FusionItem[] = [
      ...Array.from(
        { length: 50 },
        (_, i): FusionItem => [`b${i}`, 0.9 - i * 0.001]
      ),
      [shared, 0.5],
      ...Array.from(
        { length: 40 },
        (_, i): FusionItem => [`b${i + 50}`, 0.4 - i * 0.001]
      ),
    ];
    const fuser = new RrfHybridFuser([makeSource(s0), makeSource(s1)], K);
    const fused = await drain(fuser, 5);
    const ids = fused.map(([d]) => d);
    expect(ids.filter(d => d === shared).length).toBe(1);
    expect(ids.length).toBe(91); // shared + 90 distinct b's
    // settled from the rank-1 sighting only -> emitted score is the lower bound
    const sharedScore = fused.find(([d]) => d === shared)![1];
    expect(sharedScore).toBeCloseTo(1 / (K + 1), 9);
    expect(sharedScore).toBeLessThan(1 / (K + 1) + 1 / (K + 51));
    assertValidRrf(fused, [s0, s1], K);
  });

  it('handles one empty stream', async () => {
    const s0: FusionItem[] = Array.from({ length: 12 }, (_, i) => [
      `a${i}`,
      1 - i * 0.01,
    ]);
    const fuser = new RrfHybridFuser([makeSource(s0), makeSource([])], K);
    assertValidRrf(await drain(fuser, 5), [s0, []], K);
  });

  it('handles two empty streams', async () => {
    const fuser = new RrfHybridFuser([makeSource([]), makeSource([])], K);
    expect(await fuser.nextBatch(10)).toEqual([]);
  });

  it('is consistent across batch sizes', async () => {
    const s0: FusionItem[] = Array.from({ length: 20 }, (_, i) => [
      `a${i}`,
      1 - i * 0.01,
    ]);
    const s1: FusionItem[] = Array.from({ length: 20 }, (_, i) => [
      `b${i}`,
      1 - i * 0.01,
    ]);
    s1[5] = ['a3', 0.5];
    s1[9] = ['a7', 0.4];
    const oneShot = await drain(
      new RrfHybridFuser([makeSource(s0), makeSource(s1)], K),
      10000
    );
    const small = await drain(
      new RrfHybridFuser([makeSource(s0), makeSource(s1)], K),
      3
    );
    expect(oneShot).toEqual(small);
  });

  it('force-flushes under a tiny in-flight cap, still yielding every doc once', async () => {
    const s0: FusionItem[] = Array.from({ length: 40 }, (_, i) => [
      `a${i}`,
      1 - i * 0.001,
    ]);
    const s1: FusionItem[] = Array.from({ length: 40 }, (_, i) => [
      `b${i}`,
      1 - i * 0.001,
    ]);
    const fuser = new RrfHybridFuser([makeSource(s0), makeSource(s1)], K, 4);
    const ids = (await drain(fuser, 7)).map(([d]) => d);
    expect(ids.length).toBe(80);
    expect(new Set(ids).size).toBe(80);
  });

  it('reports emitted docs via hasEmitted', async () => {
    const s0: FusionItem[] = [
      ['a', 0.9],
      ['b', 0.8],
    ];
    const fuser = new RrfHybridFuser([makeSource(s0), makeSource([])], K);
    expect(fuser.hasEmitted('a')).toBe(false);
    await drain(fuser, 10);
    expect(fuser.hasEmitted('a')).toBe(true);
    expect(fuser.hasEmitted('b')).toBe(true);
    expect(fuser.hasEmitted('missing')).toBe(false);
  });
});

describe('StreamCursor', () => {
  it('lazily refills and reports exhaustion', async () => {
    const items: FusionItem[] = Array.from({ length: 5 }, (_, i) => [i, 1.0]);
    const cursor = new StreamCursor(makeSource(items, 2));
    const got: FusionPk[] = [];
    for (;;) {
      const item = await cursor.advance();
      if (item === null) break;
      got.push(item[0]);
    }
    expect(got).toEqual([0, 1, 2, 3, 4]);
    expect(cursor.reads).toBe(5);
    expect(cursor.exhausted).toBe(true);
    expect(await cursor.advance()).toBeNull(); // stays exhausted
  });
});

// --- hybridSearchIterator wrapper: output_fields passthrough --------------------

// a fake Data client: hybridSearchIterator composes real searchIterator
// instances, so the fake stubs searchIterator -- each returns an async-iterable
// replaying the pages handed in for that anns_field. No live milvus.
function fakeClient(streamsByField: Record<string, any[][]>) {
  return {
    // the fix force-includes the PK field in each sub-iterator's output_fields
    // so hit.id is populated as the fusion key; the fake hits key on `id`.
    getPkFieldName: async () => 'id',
    searchIterator: async (req: any) => {
      const pages = streamsByField[req.anns_field] || [];
      let idx = 0;
      return {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              if (idx < pages.length) {
                return { done: false, value: pages[idx++] };
              }
              return { done: true, value: null };
            },
          };
        },
      };
    },
  };
}

async function drainIterator(it: any): Promise<any[]> {
  const out: any[] = [];
  for await (const batch of it) {
    if (batch && batch.length) out.push(...batch);
  }
  return out;
}

describe('hybridSearchIterator', () => {
  it('carries output_fields through the fusion and replaces score with RRF', async () => {
    const dense = [
      [
        { id: 'x', score: 0.9, title: 'doc x' },
        { id: 'a', score: 0.8, title: 'doc a' },
      ],
    ];
    const sparse = [
      [
        { id: 'x', score: 0.5, title: 'doc x' },
        { id: 'c', score: 0.4, title: 'doc c' },
      ],
    ];
    const fake = fakeClient({ dense, sparse });
    const it = await (Data.prototype.hybridSearchIterator as any).call(fake, {
      collection_name: 'c',
      data: [
        { anns_field: 'dense', data: [0.1, 0.2] },
        { anns_field: 'sparse', data: [0.3, 0.4] },
      ],
      batchSize: 10,
      output_fields: ['title'],
    });
    const rows = await drainIterator(it);
    const ids = rows.map(r => r.id);
    expect(new Set(ids)).toEqual(new Set(['x', 'a', 'c']));
    // every fused row keeps its entity field
    for (const row of rows) {
      expect(typeof row.title).toBe('string');
      expect(row.title).toContain('doc');
    }
    // "x" is rank 1 in both modalities -> top result, RRF score 2/(K+1)
    expect(rows[0].id).toBe('x');
    expect(rows[0].score).toBeCloseTo(2 / (K + 1), 9);
    // a doc shared by both modalities is emitted once
    expect(ids.filter(d => d === 'x').length).toBe(1);
  });

  it('respects the limit', async () => {
    const dense = [
      Array.from({ length: 20 }, (_, i) => ({
        id: `a${i}`,
        score: 1 - i * 0.01,
      })),
    ];
    const fake = fakeClient({ dense });
    const it = await (Data.prototype.hybridSearchIterator as any).call(fake, {
      collection_name: 'c',
      data: [{ anns_field: 'dense', data: [0.1] }],
      batchSize: 5,
      limit: 7,
    });
    const rows = await drainIterator(it);
    expect(rows.length).toBe(7);
  });

  it('rejects a non-positive batchSize', async () => {
    const fake = fakeClient({ dense: [] });
    for (const batchSize of [0, -1]) {
      await expect(
        (Data.prototype.hybridSearchIterator as any).call(fake, {
          collection_name: 'c',
          data: [{ anns_field: 'dense', data: [0.1] }],
          batchSize,
        })
      ).rejects.toThrow('batchSize must be a positive integer');
    }
  });
});
