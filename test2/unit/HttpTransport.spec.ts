import { createFetchFixture } from '../support/http';
import { HttpBaseClient, HttpClient, HttpError } from '../../milvus';
import { expectHttpSuccess } from '../support/assertions';

const endpoint = 'http://fixture.invalid/v2';
function transport() {
  const { fetch } = createFetchFixture();
  return {
    fetch,
    client: new HttpClient({
      baseURL: endpoint,
      database: 'fixture_db',
      token: 'test-token',
      fetch,
    }),
  };
}

describe.each(['GET', 'POST'] as const)(
  'HTTP %s transport contract',
  method => {
    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });
    it('propagates authentication, explicit database and abort signal', async () => {
      const { client, fetch } = transport();
      const abortController = new AbortController();
      await client[method](
        '/probe',
        { dbName: 'explicit_db', collectionName: 'items' },
        { abortController, timeout: 1000 }
      );
      const [url, init] = fetch.mock.calls[0];
      expect(init?.signal).toBe(abortController.signal);
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer test-token',
      });
      if (method === 'GET')
        expect(new URL(String(url)).searchParams.get('dbName')).toBe(
          'explicit_db'
        );
      else
        expect(JSON.parse(init?.body as string)).toEqual({
          dbName: 'explicit_db',
          collectionName: 'items',
        });
    });
    it('aborts timed out requests, reports the failure and clears timers', async () => {
      jest.useFakeTimers();
      const warn = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const { client, fetch } = transport();
      fetch.mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(
                Object.assign(new Error('request aborted'), {
                  name: 'AbortError',
                })
              )
            );
          })
      );
      const pending = expect(
        client[method](
          '/slow',
          {},
          { timeout: 5, abortController: new AbortController() }
        )
      ).rejects.toThrow('request aborted');
      await jest.advanceTimersByTimeAsync(5);
      await pending;
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('timeout'));
      expect(jest.getTimerCount()).toBe(0);
    });
    it.each([true, false])(
      'retains HTTP status even when error-body decoding succeeds=%s',
      async bodyWorks => {
        const { client, fetch } = transport();
        fetch.mockResolvedValue({
          ok: false,
          status: 503,
          statusText: 'Unavailable',
          text: bodyWorks
            ? async () => 'backend unavailable'
            : async () => {
                throw new Error('body decode failed');
              },
        } as Response);
        await expect(client[method]('/failure')).rejects.toMatchObject({
          name: 'HttpError',
          status: 503,
          url: expect.stringContaining('/failure'),
        });
      }
    );
    it('propagates connection failures', async () => {
      const { client, fetch } = transport();
      fetch.mockRejectedValue(new Error('connection reset'));
      await expect(client[method]('/failure')).rejects.toThrow(
        'connection reset'
      );
    });
  }
);

const role = {
  roleName: 'reader',
  objectType: 'Collection',
  objectName: '*',
  privilege: 'Search',
};
const routes = [
  {
    name: 'alter alias',
    path: '/aliases/alter',
    call: (client: HttpClient) =>
      client.alterAlias({ collectionName: 'items', aliasName: 'active' }),
  },
  {
    name: 'grant privilege',
    path: '/roles/grant_privilege',
    call: (client: HttpClient) => client.grantPrivilegeToRole(role),
  },
  {
    name: 'revoke privilege',
    path: '/roles/revoke_privilege',
    call: (client: HttpClient) => client.revokePrivilegeFromRole(role),
  },
  {
    name: 'hybrid search',
    path: '/entities/hybrid_search',
    call: (client: HttpClient) =>
      client.hybridSearch({
        collectionName: 'items',
        search: [{ data: [[1, 0, 0, 0]], limit: 2 }],
        rerank: { strategy: 'rrf' },
      }),
  },
];
describe('HTTP endpoint contracts', () => {
  it.each(routes)('$name uses the correct route and database', async route => {
    const { client, fetch } = transport();
    const result = await route.call(client);
    expectHttpSuccess(result);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${endpoint}/vectordb${route.path}`);
    expect(init?.method).toBe('post');
    expect(JSON.parse(init?.body as string).dbName).toBe('fixture_db');
  });
  it.each([
    ['grantPrivilegeV2', 'grant_privilege_v2'],
    ['revokePrivilegeV2', 'revoke_privilege_v2'],
  ] as const)(
    '%s sends the privilege group and collection scope',
    async (method, route) => {
      const { client, fetch } = transport();
      const grant = {
        roleName: 'reader',
        dbName: 'tenant',
        collectionName: 'books',
        privilege: 'BookReader',
      };

      expectHttpSuccess(await client[method](grant));
      const [url, init] = fetch.mock.calls[0];
      expect(url).toBe(`${endpoint}/vectordb/roles/${route}`);
      expect(JSON.parse(init?.body as string)).toEqual(grant);
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer test-token',
      });
    }
  );

  it('preserves REST segment and binlog IDs beyond the safe integer range', async () => {
    const { client, fetch } = transport();
    fetch.mockResolvedValueOnce(
      new Response(
        '{"code":0,"data":{"segmentInfos":[{"segmentID":9223372036854775807,' +
          '"numRows":17,"insertLogs":[{"fieldID":101,"logIDs":[9007199254740993,9223372036854775807]}],' +
          '"deltaLogs":[{"fieldID":101,"logIDs":null}],"statsLogs":[{"fieldID":101,"logIDs":[]}]}]}}'
      )
    );

    const result = await client.getSegmentsInfo({
      dbName: 'tenant',
      collectionID: 18,
      segmentIDs: ['9223372036854775807'],
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${endpoint}/vectordb/segments/describe`);
    expect(init?.body).toBe(
      '{"dbName":"tenant","collectionID":18,"segmentIDs":[9223372036854775807]}'
    );
    expect(result.data.segmentInfos[0]).toEqual({
      segmentID: '9223372036854775807',
      numRows: '17',
      insertLogs: [
        { fieldID: '101', logIDs: ['9007199254740993', '9223372036854775807'] },
      ],
      deltaLogs: [{ fieldID: '101', logIDs: null }],
      statsLogs: [{ fieldID: '101', logIDs: [] }],
    });
    await client.getSegmentsInfo({ segmentIDs: [11, 12] });
    expect(fetch.mock.calls[1][1]?.body).toBe(
      '{"dbName":"fixture_db","collectionID":0,"segmentIDs":[11,12]}'
    );
  });

  it.each([Number.MAX_SAFE_INTEGER + 1, '9223372036854775808', '1,2', -1])(
    'rejects out-of-range or malformed segment ID %s',
    segmentID => {
      const { client, fetch } = transport();
      expect(() => client.getSegmentsInfo({ segmentIDs: [segmentID] })).toThrow(
        'nonnegative int64'
      );
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it('preserves HttpError identity and metadata', () => {
    const error = new HttpError('bad request', 400, 'Bad Request', '/items');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.url).toBe('/items');
  });
  it('rejects runtimes with no fetch implementation', () => {
    const original = global.fetch;
    try {
      global.fetch = undefined as unknown as typeof global.fetch;
      expect(() => new HttpBaseClient({ baseURL: endpoint })).toThrow(
        'Fetch API is not supported'
      );
    } finally {
      global.fetch = original;
    }
  });
});
