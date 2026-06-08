/**
 * Client-side RRF fusion for the hybrid search_iterator.
 *
 * Per SPEC 6.6 (emb_list iterator series), hybrid iteration is done in the SDK:
 * each modality is a stateless single-field search_iterator, and the
 * score-descending streams are fused with Reciprocal Rank Fusion via the NRA
 * threshold algorithm. This is the TypeScript port of pymilvus's
 * `_RrfHybridFuser` / `_StreamCursor` (PR 6a) -- the async batch sources are the
 * only adaptation; the fusion logic is identical.
 *
 * References: Fagin/Lotem/Naor 2003 (NRA threshold algorithm);
 * Cormack et al. 2009 (Reciprocal Rank Fusion).
 */

/** Reciprocal-rank-fusion constant `k` (Cormack et al. 2009). */
export const DEFAULT_RRF_K = 60;

/**
 * Soft bound on the NRA in-flight (seen-but-not-emitted) map. The map is bounded
 * by dense/sparse stream skew; on overflow the fuser force-flushes its best
 * in-flight document rather than failing the iteration -- client-side memory is
 * cheap.
 */
export const DEFAULT_INFLIGHT_CAP = 100000;

/** A document primary key. */
export type FusionPk = string | number;

/** One stream item: a primary key and its (descending) score. */
export type FusionItem = [FusionPk, number];

/**
 * A batch source: resolves to the next score-descending batch of items, or an
 * empty array once the stream is exhausted.
 */
export type FetchBatch = () => Promise<FusionItem[]>;

/**
 * Item-by-item, lazily-refilled view over one batched, score-descending stream.
 */
export class StreamCursor {
  private buf: FusionItem[] = [];
  private pos = 0;
  /** Number of items consumed so far. */
  reads = 0;
  /** True once the underlying stream has yielded its final (empty) batch. */
  exhausted = false;

  constructor(private readonly fetchBatch: FetchBatch) {}

  /** Consume and return the next item, or null when the stream is exhausted. */
  async advance(): Promise<FusionItem | null> {
    if (this.pos >= this.buf.length) {
      if (this.exhausted) {
        return null;
      }
      this.buf = (await this.fetchBatch()) || [];
      this.pos = 0;
      if (this.buf.length === 0) {
        this.exhausted = true;
        return null;
      }
    }
    const item = this.buf[this.pos];
    this.pos += 1;
    this.reads += 1;
    return item;
  }
}

/**
 * Incremental RRF fusion of N score-descending streams via the NRA algorithm.
 *
 * RRF is rank-based: a stream's contribution to any not-yet-seen document is
 * `1 / (k + reads_so_far + 1)`, independent of raw scores. The fuser advances
 * the least-read live stream and settles a document once no in-flight or unseen
 * document can overtake it.
 *
 * Emission order is exact: each emitted document provably out-ranks every
 * not-yet-emitted document by true RRF score. The emitted *score*, however, is a
 * lower bound -- a document is settled with the partial RRF score of the streams
 * it has been seen in so far; if it later resurfaces in a not-yet-consumed
 * stream, it is already emitted and the extra rank is dropped. Callers that need
 * the exact RRF score must re-score.
 */
export class RrfHybridFuser {
  private readonly cursors: StreamCursor[];
  /** doc id -> (stream index -> rank); the NRA in-flight (seen-but-not-emitted) map. */
  private readonly seen = new Map<FusionPk, Map<number, number>>();
  /**
   * Doc ids already emitted -- a stream resurfacing one must not re-add it to
   * `seen` (that would re-emit it; deep skewed streams hit this readily).
   */
  private readonly emitted = new Set<FusionPk>();

  constructor(
    fetchBatches: FetchBatch[],
    private readonly rrfK: number = DEFAULT_RRF_K,
    private readonly inflightCap: number = DEFAULT_INFLIGHT_CAP
  ) {
    this.cursors = fetchBatches.map(fb => new StreamCursor(fb));
  }

  /** Whether `id` has already been emitted (used to prune callers' hit maps). */
  hasEmitted(id: FusionPk): boolean {
    return this.emitted.has(id);
  }

  /** An exhausted stream can never produce another rank, so it contributes 0. */
  private contribution(cursor: StreamCursor): number {
    return cursor.exhausted ? 0 : 1 / (this.rrfK + cursor.reads + 1);
  }

  /** RRF score from the ranks already known for a document. */
  private worst(ranks: Map<number, number>): number {
    let sum = 0;
    for (const rank of ranks.values()) {
      sum += 1 / (this.rrfK + rank);
    }
    return sum;
  }

  /** Advance the least-read live stream by one item (largest RRF contribution). */
  private async advanceLeastRead(): Promise<void> {
    let idx = -1;
    let cursor: StreamCursor | null = null;
    this.cursors.forEach((c, i) => {
      if (c.exhausted) {
        return;
      }
      if (cursor === null || c.reads < cursor.reads) {
        idx = i;
        cursor = c;
      }
    });
    if (cursor === null) {
      return;
    }
    const item = await (cursor as StreamCursor).advance();
    if (item !== null) {
      const docId = item[0];
      // an already-emitted doc resurfacing in another stream is dropped --
      // it is ranked; re-adding it to `seen` would emit a duplicate
      if (!this.emitted.has(docId)) {
        let ranks = this.seen.get(docId);
        if (!ranks) {
          ranks = new Map();
          this.seen.set(docId, ranks);
        }
        if (!ranks.has(idx)) {
          ranks.set(idx, (cursor as StreamCursor).reads);
        }
      }
    }
  }

  /**
   * Return the best in-flight document if it is provably the next global
   * result, else null.
   */
  private settled(): FusionItem | null {
    if (this.seen.size === 0) {
      return null;
    }
    let tau = 0;
    for (const c of this.cursors) {
      tau += this.contribution(c);
    }
    const worsts = new Map<FusionPk, number>();
    for (const [doc, ranks] of this.seen) {
      worsts.set(doc, this.worst(ranks));
    }
    // candidate = the in-flight doc with the highest known (worst-case) score
    let cand: FusionPk | null = null;
    let candWorst = -Infinity;
    for (const [doc, w] of worsts) {
      if (w > candWorst) {
        candWorst = w;
        cand = doc;
      }
    }
    if (cand === null) {
      return null;
    }
    // an unseen document could still outrank cand
    if (candWorst < tau) {
      return null;
    }
    // an in-flight document could still outrank cand
    for (const [doc, ranks] of this.seen) {
      if (doc === cand) {
        continue;
      }
      let best = worsts.get(doc) as number;
      for (let i = 0; i < this.cursors.length; i++) {
        if (!ranks.has(i)) {
          best += this.contribution(this.cursors[i]);
        }
      }
      if (best > candWorst) {
        return null;
      }
    }
    return [cand, candWorst];
  }

  private emit(out: FusionItem[], docId: FusionPk, score: number): void {
    this.seen.delete(docId);
    this.emitted.add(docId);
    out.push([docId, score]);
  }

  /**
   * Fuse and return up to `batchSize` (docId, rrfScore) items.
   *
   * Emitted RRF-descending; the score is a lower bound on the true RRF score
   * (see the class docstring). State persists across calls for the lifetime of
   * the iterator.
   */
  async nextBatch(batchSize: number): Promise<FusionItem[]> {
    const out: FusionItem[] = [];
    while (out.length < batchSize) {
      const settled = this.settled();
      if (settled !== null) {
        this.emit(out, settled[0], settled[1]);
        continue;
      }
      if (this.cursors.every(c => c.exhausted)) {
        // no stream can advance; settled() has already drained `seen`
        break;
      }
      await this.advanceLeastRead();
      // force-flush the best in-flight doc on overflow -- bound memory on
      // skewed streams without failing the iteration
      if (this.inflightCap && this.seen.size > this.inflightCap) {
        let cand: FusionPk | null = null;
        let candWorst = -Infinity;
        for (const [doc, ranks] of this.seen) {
          const w = this.worst(ranks);
          if (w > candWorst) {
            candWorst = w;
            cand = doc;
          }
        }
        if (cand !== null) {
          this.emit(out, cand, candWorst);
        }
      }
    }
    return out;
  }
}
