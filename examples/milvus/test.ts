import fetch from 'node-fetch';

type CreateCollectionResponse = {
  code: number;
  message?: string;
  data?: Record<string, unknown>;
};

type InsertResponse = {
  code: number;
  message?: string;
  data?: {
    insertCount: number;
    insertIds: number[] | string[];
  };
};

type FlushResponse = {
  code: number;
  message?: string;
  data?: Record<string, unknown>;
};

type StatsResponse = {
  code: number;
  message?: string;
  data?: {
    rowCount: number;
  };
};

const DEFAULT_DIMENSION = 4;
const DEFAULT_COLLECTION = 'restful_demo_collection';

const sleep = (ms: number) =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

const buildBaseUrl = (endpoint: string) => {
  if (!endpoint) {
    throw new Error('CLUSTER_ENDPOINT is required');
  }
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  return `https://${endpoint}`;
};

const buildAuthHeader = (token: string) => {
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
};

async function post<T>(
  baseUrl: string,
  token: string,
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }

  return (await res.json()) as T;
}

const generateData = (count: number, dimension: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    vector: Array.from({ length: dimension }, () => Math.random()),
  }));

async function main() {
  const endpoint = process.env.CLUSTER_ENDPOINT ?? 'http://127.0.0.1:19530';
  const token = process.env.TOKEN ?? '';
  const dbName = process.env.DB_NAME;
  const collectionName =
    process.env.COLLECTION_NAME ?? DEFAULT_COLLECTION;
  const dimension = Number(process.env.DIMENSION ?? DEFAULT_DIMENSION);

  const baseUrl = buildBaseUrl(endpoint);

  const createBody = {
    dbName,
    collectionName,
    consistencyLevel: 'Strong',
    schema: {
      autoID: false,
      enabledDynamicField: false,
      fields: [
        {
          fieldName: 'id',
          dataType: 'Int64',
          isPrimary: true,
        },
        {
          fieldName: 'vector',
          dataType: 'FloatVector',
          elementTypeParams: {
            dim: dimension,
          },
        },
      ],
    },
  };

  const createRes = await post<CreateCollectionResponse>(
    baseUrl,
    token,
    '/v2/vectordb/collections/create',
    createBody
  );

  if (createRes.code !== 0) {
    throw new Error(
      `Create collection failed: ${createRes.message ?? 'unknown error'}`
    );
  }

  const insertRes = await post<InsertResponse>(
    baseUrl,
    token,
    '/v2/vectordb/entities/insert',
    {
      dbName,
      collectionName,
      data: generateData(100, dimension),
    }
  );

  if (insertRes.code !== 0) {
    throw new Error(
      `Insert failed: ${insertRes.message ?? 'unknown error'}`
    );
  }

  const flushRes = await post<FlushResponse>(
    baseUrl,
    token,
    '/v2/vectordb/collections/flush',
    {
      dbName,
      collectionName,
    }
  );

  if (flushRes.code !== 0) {
    throw new Error(`Flush failed: ${flushRes.message ?? 'unknown error'}`);
  }

  await sleep(1000);

  const statsRes = await post<StatsResponse>(
    baseUrl,
    token,
    '/v2/vectordb/collections/get_stats',
    {
      dbName,
      collectionName,
    }
  );

  if (statsRes.code !== 0) {
    throw new Error(
      `Get stats failed: ${statsRes.message ?? 'unknown error'}`
    );
  }

  console.log(
    `rowCount: ${statsRes.data?.rowCount ?? 'unknown'} (inserted ${
      insertRes.data?.insertCount ?? 0
    })`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
