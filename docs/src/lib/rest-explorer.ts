import { DEFAULT_HTTP_ENDPOINT_VERSION } from '../../../milvus/const/defaults';

export type JsonObject = Record<string, unknown>;

export function requestUrl(endpoint: string, path: string) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error('Enter an HTTPS endpoint or a loopback HTTP URL.');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error(
      'Use HTTPS or loopback HTTP (localhost, 127.0.0.1, or [::1]).'
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'Enter the cluster URL without credentials, query parameters, or fragments.'
    );
  }
  let prefix = url.pathname.replace(/\/+$/, '');
  const versionSuffix = `/${DEFAULT_HTTP_ENDPOINT_VERSION}`;
  if (prefix.endsWith(versionSuffix))
    prefix = prefix.slice(0, -versionSuffix.length);
  return `${url.origin}${prefix}${path}`;
}

export function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function requestBody(text: string) {
  const body: unknown = JSON.parse(text);
  if (!isObject(body))
    throw new Error('The request body must be a JSON object.');
  return body;
}

function shellQuote(value: string) {
  return "'" + value.replace(/'/g, "'\"'\"'") + "'";
}

export function curlCommand(url: string, body: string, authenticated: boolean) {
  return [
    `curl --request POST --url ${shellQuote(url)}`,
    "--header 'Content-Type: application/json'",
    ...(authenticated
      ? ['--header "Authorization: Bearer ${MILVUS_TOKEN}"']
      : []),
    `--data-raw ${shellQuote(body)}`,
  ].join(' \\\n  ');
}

export function schemaFields(response: unknown) {
  if (!isObject(response) || !Array.isArray(response.fields)) return [];
  return response.fields.filter(isObject).flatMap((field) => {
    if (typeof field.name !== 'string' || typeof field.type !== 'string')
      return [];
    const params = field.params;
    const dim = Array.isArray(params)
      ? params.filter(isObject).find((parameter) => parameter.key === 'dim')
          ?.value
      : isObject(params)
        ? params.dim
        : undefined;
    return [
      {
        name: field.name,
        type: field.type,
        dimension:
          typeof dim === 'string' || typeof dim === 'number'
            ? Number(dim)
            : NaN,
      },
    ];
  });
}

export function denseVector(dimension: number) {
  if (!Number.isInteger(dimension) || dimension < 1 || dimension > 32768) {
    throw new Error(
      'The schema does not provide a supported dense vector dimension. Enter search data manually.'
    );
  }
  return Array.from({ length: dimension }, (_, index) => (index === 0 ? 1 : 0));
}
