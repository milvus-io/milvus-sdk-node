import {
  DataTypeStringEnum,
  ErrorCode,
  FieldSchema,
  getQueryIteratorExpr,
  MilvusClient,
} from '../../milvus';

describe('primary key expressions', () => {
  let client: MilvusClient;
  let rpc: jest.Mock;

  beforeEach(() => {
    client = new MilvusClient({
      address: 'localhost:19530',
      __SKIP_CONNECT__: true,
      pool: { min: 0, max: 1, autostart: false },
    });
    jest.spyOn(client, 'getPkFieldName').mockResolvedValue('id');
    jest.spyOn(client, 'getPkFieldType').mockResolvedValue('VarChar');
    rpc = jest.fn((_params, _options, callback) =>
      callback(null, {
        status: { error_code: ErrorCode.SUCCESS, reason: '' },
        fields_data: [],
      })
    );
    (client as any).channelPool = {
      acquire: jest.fn().mockResolvedValue({ Query: rpc, Delete: rpc }),
      release: jest.fn(),
    };
  });

  describe.each(['get', 'query', 'delete'] as const)('%s', method => {
    it('escapes VARCHAR primary keys in the RPC expression', async () => {
      await client[method]({
        collection_name: 'test_collection',
        ids: [
          'chapter "intro"',
          'C:\\notes',
          'line\nbreak',
          "O'Reilly",
          '',
          '你好',
        ],
      });

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc.mock.calls[0][0].expr).toBe(
        String.raw`id in ["chapter \"intro\"","C:\\notes","line\nbreak","O'Reilly","","你好"]`
      );
    });

    it.each([
      [[0, 42], 'id in [0,42]'],
      [
        ['9007199254740993', '9223372036854775807'],
        'id in [9007199254740993,9223372036854775807]',
      ],
    ])(
      'preserves Int64 IDs %j without quotes or precision loss',
      async (ids, expr) => {
        jest.spyOn(client, 'getPkFieldType').mockResolvedValue('Int64');
        await client[method]({
          collection_name: 'test_collection',
          ids: ids as string[] | number[],
        });

        expect(rpc.mock.calls[0][0].expr).toBe(expr);
      }
    );
  });

  it.each(['query', 'delete'] as const)(
    'preserves filter precedence for %s',
    async method => {
      await client[method]({
        collection_name: 'test_collection',
        ids: ['chapter "intro"'],
        filter: 'id == "chosen"',
      });

      expect(rpc.mock.calls[0][0].expr).toBe('id == "chosen"');
    }
  );

  it('keeps an empty deletion list distinct from an empty string ID', async () => {
    await client.delete({ collection_name: 'test_collection', ids: [] });
    expect(rpc.mock.calls[0][0].expr).toBe('id in []');
  });

  it.each([undefined, 1])(
    'escapes query iterator cursors with element offset %s',
    lastElementOffset => {
      const result = getQueryIteratorExpr({
        pkField: {
          name: 'id',
          data_type: DataTypeStringEnum.VarChar,
        } as FieldSchema,
        lastPKId: 'O\'Reilly "notes"\\draft\n',
        lastElementOffset,
        expr: 'active == true || score > 10',
      });

      const condition = lastElementOffset === undefined ? '>' : '>=';
      expect(result).toBe(
        `id ${condition} ` +
          String.raw`"O'Reilly \"notes\"\\draft\n" && (active == true || score > 10)`
      );
    }
  );
});
