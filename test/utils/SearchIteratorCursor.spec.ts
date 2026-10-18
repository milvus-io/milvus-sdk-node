import Long from 'long';
import {
  DataType,
  ErrorCode,
  MilvusClient,
  buildSearchRequest,
} from '../../milvus';

const VERSION = 'search_iter_cursor_version';
const PK_TYPE = 'search_iter_last_pk_type';
const PK = 'search_iter_last_pk';

const status = () => ({
  error_code: ErrorCode.SUCCESS,
  code: 0,
  reason: '',
  extra_info: {},
});
const page = (
  ids: string[],
  version: string | undefined | null = '2',
  type = 'int64',
  timestamp: string | number = '100'
) => ({
  status: {
    ...status(),
    extra_info: {
      ...(version ? { [VERSION]: version } : {}),
      ...(ids.length && version === '2'
        ? { [PK_TYPE]: type, [PK]: ids[ids.length - 1] }
        : {}),
    },
  },
  results: ids.map(id => ({ id, score: 0.25 })),
  session_ts: timestamp,
  search_iterator_v2_results: { token: 'token', last_bound: 0.25 },
});

function fixture(replies: any[], options: any = {}) {
  const client = new MilvusClient({
    address: 'localhost:19530',
    __SKIP_CONNECT__: true,
  });
  const collection = {
    status: status(),
    collectionID: '17',
    consistency_level: 0,
    anns_fields: {
      v: {
        name: 'v',
        dataType: DataType.FloatVector,
        data_type: 'FloatVector',
        type_params: [{ key: 'dim', value: '2' }],
        index_params: [],
      },
    },
    schema: {
      fields: [
        {
          name: 'id',
          data_type: options.pkType || DataType.Int64,
          is_primary_key: true,
        },
        {
          name: 'v',
          data_type: DataType.FloatVector,
          type_params: [{ key: 'dim', value: '2' }],
        },
      ],
    },
  };
  jest
    .spyOn(client, 'count')
    .mockResolvedValue({ status: status(), data: options.count ?? 20 } as any);
  jest.spyOn(client, 'describeCollection').mockResolvedValue(collection as any);
  const calls: any[] = [];
  jest.spyOn(client, 'search').mockImplementation(async (request: any) => {
    calls.push({ ...request, params: { ...request.params } });
    const reply = replies.shift();
    if (reply instanceof Error) throw reply;
    if (!reply) throw new Error('No mock response');
    const idType = options.pkType === DataType.VarChar ? 'str_id' : 'int_id';
    (client as any).retainSearchIteratorCursor(reply, {
      status: reply.status,
      results: {
        num_queries: 1,
        topks: [reply.results.length],
        scores: reply.results.map((row: any) => row.score),
        ids: {
          id_field: idType,
          [idType]: {
            data:
              reply.rawIds ||
              options.rawIds ||
              reply.results.map((row: any) => row.id),
          },
        },
      },
    });
    return reply;
  });
  return { client, calls, collection };
}

const request = (options: any = {}, pkCursor = true) => ({
  collection_name: 'c',
  data: [1, 2],
  batchSize: 2,
  ...options,
  params: { ...(pkCursor ? { [VERSION]: '2' } : {}), ...options.params },
});

describe('Search iterator cursor negotiation', () => {
  it('counts same-page duplicate PKs once against the raw limit', async () => {
    const { client, calls } = fixture([page(['1', '1']), page(['2'])]);
    const iterator = (await client.searchIterator(request({ limit: 2 })))[
      Symbol.asyncIterator
    ]();
    expect((await iterator.next()).value.map((row: any) => row.id)).toEqual([
      '1',
    ]);
    expect((await iterator.next()).value.map((row: any) => row.id)).toEqual([
      '2',
    ]);
    expect((await iterator.next()).done).toBe(true);
    expect(calls[1].limit).toBe(1);
  });

  it('rejects an inexact raw PK before the final cursor without committing the page', async () => {
    const bad = page(['9007199254740993', '2']) as any;
    bad.rawIds = [9007199254740992, '2'];
    const { client, calls } = fixture([bad, page(['9007199254740993', '2'])]);
    const iterator = (await client.searchIterator(request()))[
      Symbol.asyncIterator
    ]();
    await expect(iterator.next()).rejects.toThrow('exact raw response IDs');
    expect((await iterator.next()).value.map((row: any) => row.id)).toEqual([
      '9007199254740993',
      '2',
    ]);
    expect(calls[1].params[PK]).toBeUndefined();
    expect(calls[1].guarantee_timestamp).toBe(0);
  });

  it('skips duplicate-only score pages without consuming the distinct limit', async () => {
    const high = '9007199254740993';
    const next = '9007199254740994';
    const replies = [page([high]), page([high]), page([next])];
    replies.forEach((reply, score) => {
      reply.results[0].score = score;
      reply.search_iterator_v2_results.last_bound = score;
    });
    const { client, calls } = fixture(replies);
    const iterator = (
      await client.searchIterator(request({ batchSize: 1, limit: 2 }))
    )[Symbol.asyncIterator]();
    expect((await iterator.next()).value[0].id).toBe(high);
    expect((await iterator.next()).value[0].id).toBe(next);
    expect((await iterator.next()).done).toBe(true);
    expect(calls).toHaveLength(3);
    expect(calls[2].params[PK]).toBe(high);
    expect(calls[2].params.search_iter_last_bound).toBe(1);
  });

  it('skips empty varchar duplicates across score pages', async () => {
    const replies = [
      page([''], '2', 'varchar'),
      page([''], '2', 'varchar'),
      page(['雪'], '2', 'varchar'),
    ];
    replies.forEach((reply, score) => {
      reply.results[0].score = score;
      reply.search_iterator_v2_results.last_bound = score;
    });
    const { client, calls } = fixture(replies, { pkType: DataType.VarChar });
    const iterator = (
      await client.searchIterator(request({ batchSize: 1, limit: 2 }))
    )[Symbol.asyncIterator]();
    expect((await iterator.next()).value[0].id).toBe('');
    expect((await iterator.next()).value[0].id).toBe('雪');
    expect((await iterator.next()).done).toBe(true);
    expect(calls[2].params[PK]).toBe('');
  });

  it('deduplicates raw PKs independently of transformed display IDs', async () => {
    const replies = [page(['1']), page(['1']), page(['2'])] as any[];
    replies.forEach((reply, index) => {
      reply.rawIds = reply.results.map((row: any) => row.id);
      reply.results[0].id = index === 1 ? 'different display' : 'same display';
      reply.results[0].score = index;
      reply.search_iterator_v2_results.last_bound = index;
    });
    const { client, calls } = fixture(replies);
    const iterator = (
      await client.searchIterator(request({ batchSize: 1, limit: 2 }))
    )[Symbol.asyncIterator]();
    expect((await iterator.next()).value[0].id).toBe('same display');
    expect((await iterator.next()).value[0].id).toBe('same display');
    expect((await iterator.next()).done).toBe(true);
    expect(calls).toHaveLength(3);
  });

  it('retains pending page, keys, cursor and limit after a filter throws', async () => {
    const replies = [page(['1']), page(['1']), page(['2'])];
    replies.forEach((reply, index) => {
      reply.results[0].score = index;
      reply.search_iterator_v2_results.last_bound = index;
    });
    let fail = true;
    const { client, calls } = fixture(replies);
    const iterator = (
      await client.searchIterator(
        request({
          batchSize: 1,
          limit: 2,
          external_filter_fn: (row: any) => {
            if (fail) {
              fail = false;
              row.id = 'mutated';
              throw new Error('filter');
            }
            return true;
          },
        })
      )
    )[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toThrow('filter');
    expect((await iterator.next()).value[0].id).toBe('1');
    expect(calls).toHaveLength(1);
    expect((await iterator.next()).value[0].id).toBe('2');
    expect((await iterator.next()).done).toBe(true);
    expect(calls[1].params.search_iter_last_bound).toBe(0);
    expect(calls[2].params.search_iter_last_bound).toBe(1);
  });

  it('retains duplicate rows and raw limit semantics in default distance mode', async () => {
    const { client, calls } = fixture([page(['1'], null), page(['1'], null)]);
    const iterator = (
      await client.searchIterator(request({ batchSize: 1, limit: 2 }, false))
    )[Symbol.asyncIterator]();
    expect((await iterator.next()).value[0].id).toBe('1');
    expect((await iterator.next()).value[0].id).toBe('1');
    expect((await iterator.next()).done).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[1].params[VERSION]).toBeUndefined();
  });

  it('preserves an exact Long snapshot from the supported custom protobuf loader', async () => {
    const snapshot = Long.fromString('467000000000000001', true);
    const response = page(['1']);
    (response as any).session_ts = snapshot;
    const { client, calls } = fixture([response, page([])]);
    const iterator = (await client.searchIterator(request()))[
      Symbol.asyncIterator
    ]();
    await iterator.next();
    await iterator.next();
    expect(calls[1].guarantee_timestamp).toBe(snapshot);
    expect(calls[1].guarantee_timestamp.toString()).toBe('467000000000000001');
  });

  it('preserves the exact uint64 snapshot string on continuation and explicit requests', async () => {
    const snapshot = '467000000000000001';
    for (const explicit of [false, true]) {
      const { client, calls } = fixture([
        page(['1'], '2', 'int64', snapshot),
        page([], '2', 'int64', '467000000000000002'),
      ]);
      const iterator = (
        await client.searchIterator(
          request(explicit ? { guarantee_timestamp: snapshot } : {})
        )
      )[Symbol.asyncIterator]();
      await iterator.next();
      await iterator.next();
      expect(calls[0].guarantee_timestamp).toBe(explicit ? snapshot : 0);
      expect(calls[1].guarantee_timestamp).toBe(snapshot);
      expect(calls[1].params.guarantee_timestamp).toBeUndefined();
    }
  });

  it.each([9007199254740992, 301.5, Infinity, '18446744073709551616'])(
    'rejects an inexact or invalid PK snapshot without advancing the cursor: %s',
    async snapshot => {
      const { client, calls } = fixture([
        page(['1'], '2', 'int64', snapshot),
        page(['1'], '2', 'int64', '467000000000000001'),
      ]);
      const iterator = (await client.searchIterator(request()))[
        Symbol.asyncIterator
      ]();
      await expect(iterator.next()).rejects.toThrow('exact uint64 snapshot');
      expect((await iterator.next()).value[0].id).toBe('1');
      expect(calls[1].params.search_iter_id).toBeUndefined();
      expect(calls[1].guarantee_timestamp).toBe(0);
    }
  );

  it('scans its selected snapshot until empty even if a current count would be zero', async () => {
    for (const pkCursor of [false, true]) {
      const mode = pkCursor ? '2' : null;
      const { client, calls } = fixture(
        [page(['1', '2'], mode), page(['3'], mode), page([], mode)],
        { count: 0 }
      );
      const iterator = (
        await client.searchIterator(
          request({ guarantee_timestamp: '42' }, pkCursor)
        )
      )[Symbol.asyncIterator]();
      expect((await iterator.next()).value.map((row: any) => row.id)).toEqual([
        '1',
        '2',
      ]);
      expect((await iterator.next()).value.map((row: any) => row.id)).toEqual([
        '3',
      ]);
      expect((await iterator.next()).done).toBe(true);
      expect((await iterator.next()).done).toBe(true);
      expect(client.count).not.toHaveBeenCalled();
      expect(calls.every(call => call.guarantee_timestamp === '42')).toBe(true);
      expect(calls).toHaveLength(3);
    }
  });

  it('validates the raw proto ID independently of transformed result rows', async () => {
    const response = page(['9007199254740993']);
    response.results[0].id = 'transformed';
    const { client } = fixture([response], { rawIds: ['9007199254740993'] });
    const iterator = (await client.searchIterator(request()))[
      Symbol.asyncIterator
    ]();
    expect((await iterator.next()).value[0].id).toBe('transformed');
  });

  it('rejects int64 cursor comparison when a custom number loader has already lost precision', async () => {
    const { client } = fixture([page(['9007199254740993'])], {
      rawIds: [9007199254740992],
    });
    const iterator = (await client.searchIterator(request()))[
      Symbol.asyncIterator
    ]();
    await expect(iterator.next()).rejects.toThrow('raw response IDs');
  });
  it('uses no dummy RPC, preserves a raw int64 cursor and timestamp on the top-level request', async () => {
    const high = '9007199254740993';
    const { client, calls } = fixture([
      page(['1', high]),
      page(['9007199254740994']),
      page([]),
    ]);
    const result = await client.searchIterator(request());
    expect(calls).toHaveLength(0);
    const iterator = result[Symbol.asyncIterator]();
    expect((await iterator.next()).value.map((row: any) => row.id)).toEqual([
      '1',
      high,
    ]);
    expect(calls).toHaveLength(1);
    await iterator.next();
    expect(calls[0].limit).toBe(2);
    expect(calls[0].params[VERSION]).toBe('2');
    expect(calls[1].params[PK]).toBe(high);
    expect(calls[1].params[PK_TYPE]).toBe('int64');
    expect(calls[1].guarantee_timestamp).toBe('100');
    expect(calls[1].params).not.toHaveProperty('guarantee_timestamp');
    expect((await iterator.next()).done).toBe(true);
    expect((await iterator.next()).done).toBe(true);
    expect(calls).toHaveLength(3);
  });

  it.each(['-9223372036854775808', '9223372036854775807', '9007199254740993'])(
    'keeps int64 %s exact',
    async pk => {
      const { client, calls } = fixture([page([pk]), page([])]);
      const iterator = (await client.searchIterator(request()))[
        Symbol.asyncIterator
      ]();
      expect((await iterator.next()).value[0].id).toBe(pk);
      await iterator.next();
      expect(calls[1].params[PK]).toBe(pk);
    }
  );

  it.each(['', '雪"\\\n', 'nul\u0000尾'])('keeps raw varchar %s', async pk => {
    const { client, calls } = fixture(
      [page([pk], '2', 'varchar'), page([], '2', 'varchar')],
      { pkType: DataType.VarChar }
    );
    const iterator = (await client.searchIterator(request()))[
      Symbol.asyncIterator
    ]();
    expect((await iterator.next()).value[0].id).toBe(pk);
    await iterator.next();
    expect(calls[1].params[PK]).toBe(pk);
  });

  it.each(['3', null])(
    'rejects loss/change of negotiated capability %s without advancing the cursor',
    async version => {
      const { client, calls } = fixture([
        page(['1']),
        page(['2'], version),
        page(['2']),
      ]);
      const iterator = (await client.searchIterator(request()))[
        Symbol.asyncIterator
      ]();
      await iterator.next();
      await expect(iterator.next()).rejects.toThrow('cursor version');
      await iterator.next();
      expect(calls[1].params[PK]).toBe('1');
      expect(calls[2].params[PK]).toBe('1');
    }
  );

  it('propagates RPC and server errors instead of returning EOF', async () => {
    const failure = page(['2']);
    failure.status.reason = 'server failure';
    failure.status.code = 1;
    const { client, calls } = fixture([
      page(['1']),
      new Error('rpc failure'),
      failure,
      page(['2']),
    ]);
    const iterator = (await client.searchIterator(request()))[
      Symbol.asyncIterator
    ]();
    await iterator.next();
    await expect(iterator.next()).rejects.toThrow('rpc failure');
    await expect(iterator.next()).rejects.toThrow('server failure');
    expect((await iterator.next()).value[0].id).toBe('2');
    expect(calls.slice(1).every(call => call.params[PK] === '1')).toBe(true);
  });

  it('does not silently upgrade a legacy iterator and removes the opt-in after its first reply', async () => {
    const { client, calls } = fixture([page(['1'], null), page(['2'])]);
    const iterator = (await client.searchIterator(request()))[
      Symbol.asyncIterator
    ]();
    await iterator.next();
    await expect(iterator.next()).rejects.toThrow('cursor version');
    expect(calls[1].params).not.toHaveProperty(VERSION);
    expect(calls[1].params).not.toHaveProperty(PK);
  });

  it('requires a positive server snapshot in PK mode but preserves explicit snapshots', async () => {
    let fixtureResult = fixture([page(['1'], '2', 'int64', 0)]);
    let iterator = (await fixtureResult.client.searchIterator(request()))[
      Symbol.asyncIterator
    ]();
    await expect(iterator.next()).rejects.toThrow('snapshot');
    fixtureResult = fixture([page(['1'], '2', 'int64', 0), page(['2'])]);
    iterator = (
      await fixtureResult.client.searchIterator(
        request({ guarantee_timestamp: '42' })
      )
    )[Symbol.asyncIterator]();
    await iterator.next();
    await iterator.next();
    expect(
      fixtureResult.calls.every(call => call.guarantee_timestamp === '42')
    ).toBe(true);
  });

  it('preserves request reuse, raw-row limit semantics, and retries a mutating failing predicate', async () => {
    let attempts = 0;
    const supplied = request({
      limit: 3,
      params: { [PK]: 'old', [PK_TYPE]: 'int64', guarantee_timestamp: '42' },
      external_filter_fn: (row: any) => {
        if (attempts++ === 0) {
          row.id = 'mutated';
          throw new Error('predicate');
        }
        return row.id !== '1';
      },
    });
    const originalParams = { ...supplied.params };
    const { client, calls } = fixture([page(['1', '2']), page(['3'])]);
    const iterator = (await client.searchIterator(supplied))[
      Symbol.asyncIterator
    ]();
    await expect(iterator.next()).rejects.toThrow('predicate');
    expect((await iterator.next()).value.map((row: any) => row.id)).toEqual([
      '2',
    ]);
    expect(calls).toHaveLength(1);
    expect((await iterator.next()).value.map((row: any) => row.id)).toEqual([
      '3',
    ]);
    expect((await iterator.next()).done).toBe(true);
    expect(calls[1].limit).toBe(1);
    expect(calls[1].params[PK]).toBe('2');
    expect(calls[0].params).not.toHaveProperty(PK);
    expect(supplied.params).toEqual(originalParams);
    expect(supplied.limit).toBe(3);
  });

  it.each(['9223372036854775808', '1.0', '+1', '01', '2'])(
    'rejects malformed or mismatched int64 cursor %s',
    async value => {
      const bad = page(['1']);
      bad.status.extra_info[PK] = value;
      const { client } = fixture([bad]);
      const iterator = (await client.searchIterator(request()))[
        Symbol.asyncIterator
      ]();
      await expect(iterator.next()).rejects.toThrow('PK cursor');
    }
  );

  it('rejects a schema mismatch and missing V2 token rather than yielding empty data', async () => {
    const { client } = fixture([page(['1'], '2', 'varchar')]);
    const iterator = (await client.searchIterator(request()))[
      Symbol.asyncIterator
    ]();
    await expect(iterator.next()).rejects.toThrow('schema');
    const unsupported = page(['1'], null);
    unsupported.search_iterator_v2_results.token = '';
    const other = fixture([unsupported]);
    await expect(
      (await other.client.searchIterator(request()))
        [Symbol.asyncIterator]()
        .next()
    ).rejects.toThrow('V2');
  });

  it('default distance mode does not request PK scans and rejects unsolicited mode2', async () => {
    const { client, calls } = fixture([page(['1'], null), page(['2'], null)]);
    const iterator = (await client.searchIterator(request({}, false)))[
      Symbol.asyncIterator
    ]();
    await iterator.next();
    await iterator.next();
    expect(calls.every(call => !(VERSION in call.params))).toBe(true);
    const unsolicited = fixture([page(['1'])]);
    await expect(
      (await unsolicited.client.searchIterator(request({}, false)))
        [Symbol.asyncIterator]()
        .next()
    ).rejects.toThrow('cursor version');
    await expect(
      client.searchIterator(request({ params: { [VERSION]: '3' } }))
    ).rejects.toThrow('Unsupported');
  });

  it('keeps manual legacy bound token and explicit snapshot without PK opt-in', async () => {
    const supplied = request(
      {
        params: {
          search_iter_last_bound: 0.5,
          search_iter_id: 'token',
          guarantee_timestamp: '42',
        },
      },
      false
    );
    const { client, calls } = fixture([page(['2'], null), page(['3'], null)]);
    const iterator = (await client.searchIterator(supplied))[
      Symbol.asyncIterator
    ]();
    await iterator.next();
    await iterator.next();
    expect(calls[0].params.search_iter_last_bound).toBe(0.5);
    expect(calls[0].params.search_iter_id).toBe('token');
    expect(
      calls.every(
        call => call.guarantee_timestamp === '42' && !(VERSION in call.params)
      )
    ).toBe(true);
    expect(supplied.params.search_iter_last_bound).toBe(0.5);
    await expect(
      client.searchIterator(
        request({
          params: { search_iter_last_bound: 0.5, search_iter_id: 'token' },
        })
      )
    ).rejects.toThrow('legacy');
  });

  it('malformed raw reply shapes or bounds do not advance pagination state', async () => {
    for (const badShape of [
      { nq: 2 },
      { topks: [] },
      { idCount: 3 },
      { scoreCount: 2 },
      { lastScore: 0.5 },
      { finiteScores: false },
    ]) {
      const bad = page(['2']);
      const { client, calls } = fixture([page(['1']), bad, page(['2'])]);
      const capture = (client as any).retainSearchIteratorCursor.bind(client);
      (client as any).retainSearchIteratorCursor = (result: any, raw: any) => {
        capture(result, raw);
        if (result === bad)
          Object.assign(
            (client as any).searchIteratorCursorInfo.get(result),
            badShape
          );
        return result;
      };
      const iterator = (await client.searchIterator(request()))[
        Symbol.asyncIterator
      ]();
      await iterator.next();
      await expect(iterator.next()).rejects.toThrow(
        'raw result shape or score'
      );
      await iterator.next();
      expect(calls[1].params[PK]).toBe('1');
      expect(calls[2].params[PK]).toBe('1');
    }
  });

  it('checks the raw score even when the public distance has been rounded', async () => {
    const response = page(['1']);
    response.results[0].score = 0.12;
    response.search_iterator_v2_results.last_bound = 0.123456;
    const { client } = fixture([response]);
    const capture = (client as any).retainSearchIteratorCursor.bind(client);
    (client as any).retainSearchIteratorCursor = (result: any, raw: any) => {
      raw.results.scores = [0.123456];
      return capture(result, raw);
    };
    const iterator = (
      await client.searchIterator(request({ round_decimal: 2 }))
    )[Symbol.asyncIterator]();
    expect((await iterator.next()).value[0].score).toBe(0.12);
  });

  it('serializes timestamp at the SearchRequest top level and raw varchar without JSON encoding', () => {
    const { client, collection } = fixture([]);
    const { request: wire } = buildSearchRequest(
      request({
        guarantee_timestamp: '18446744073709551615',
        params: { [VERSION]: '2', [PK_TYPE]: 'varchar', [PK]: '雪"\\' },
      }),
      collection as any,
      (client as any).milvusProto
    );
    expect((wire as any).guarantee_timestamp).toBe('18446744073709551615');
    expect(
      (wire as any).search_params?.find((kv: any) => kv.key === PK)?.value
    ).toBe('雪"\\');
    expect(
      (wire as any).search_params?.some(
        (kv: any) => kv.key === 'guarantee_timestamp'
      )
    ).toBe(false);
  });
});
