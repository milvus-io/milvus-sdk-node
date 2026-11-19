import { execFileSync } from 'child_process';
import {
  curlCommand,
  denseVector,
  requestBody,
  requestUrl,
  schemaFields,
} from '../../docs/src/lib/rest-explorer';

describe('REST explorer request helpers', () => {
  it('uses the SDK v2 routes with an optional endpoint prefix', () => {
    expect(
      requestUrl('https://cluster.example.com/proxy/v2/', 'listCollections')
    ).toBe('https://cluster.example.com/proxy/v2/vectordb/collections/list');
    expect(requestUrl('http://127.0.0.1:19530', 'describeCollection')).toBe(
      'http://127.0.0.1:19530/v2/vectordb/collections/describe'
    );
    expect(requestUrl('http://[::1]:19530', 'query')).toBe(
      'http://[::1]:19530/v2/vectordb/entities/query'
    );
  });

  it.each([
    'http://cluster.example.com',
    'https://user:password@cluster.example.com',
    'https://cluster.example.com/?token=secret',
    'https://cluster.example.com/#fragment',
    'file:///tmp/endpoint',
  ])('rejects unsupported endpoints (%s)', endpoint => {
    expect(() => requestUrl(endpoint, 'search')).toThrow();
  });

  it('quotes the URL and JSON as literal shell arguments', () => {
    const url =
      "https://cluster.example.com/owner's/v2/vectordb/entities/query";
    const json = JSON.stringify({
      filter: "name == '$(printf expanded)'; `printf expanded`",
    });
    const command = curlCommand(url, json);
    expect(command).toContain('${MILVUS_TOKEN}');
    const output = execFileSync(
      'sh',
      [
        '-c',
        `curl() { printf '%s\\n' "$@"; }; MILVUS_TOKEN='sample token'; ${command}`,
      ],
      { encoding: 'utf8' }
    );
    expect(output.trimEnd().split('\n')).toEqual([
      '--request',
      'POST',
      '--url',
      url,
      '--header',
      'Content-Type: application/json',
      '--header',
      'Authorization: Bearer sample token',
      '--data-raw',
      json,
    ]);
  });

  it('accepts objects and rejects malformed or non-object JSON', () => {
    expect(requestBody('{"dbName":"default"}')).toEqual({ dbName: 'default' });
    for (const value of ['{', 'null', '[]', '"books"']) {
      expect(() => requestBody(value)).toThrow();
    }
  });

  it('generates a vector using the dimension from the describe response', () => {
    const [field] = schemaFields({
      fields: [
        {
          name: 'embedding',
          type: 'FloatVector',
          params: [{ key: 'dim', value: '4' }],
        },
      ],
    });
    expect(field).toEqual({
      name: 'embedding',
      type: 'FloatVector',
      dimension: 4,
    });
    expect(denseVector(field.dimension)).toEqual([1, 0, 0, 0]);
    expect(() => denseVector(NaN)).toThrow();
  });
});
