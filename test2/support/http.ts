export interface CapturedRequest {
  url: string;
  init: RequestInit;
}

/** Shared fetch boundary: record wire requests without mocking SDK methods. */
export function createFetchFixture(body: unknown = { code: 0, data: [] }) {
  const requests: CapturedRequest[] = [];
  const fetch = jest
    .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
    .mockImplementation(async (url, init = {}) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  return { fetch, requests };
}
