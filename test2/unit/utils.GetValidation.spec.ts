import { ERROR_REASONS, GetReq, MilvusClient } from '../../milvus';

describe('get primary key validation', () => {
  it.each([undefined, null, [], '1'])(
    'rejects invalid ids %p before querying',
    async ids => {
      const query = jest.fn();
      const client = { query } as unknown as MilvusClient;
      await expect(
        MilvusClient.prototype.get.call(client, {
          collection_name: 'validation',
          ids,
        } as GetReq)
      ).rejects.toThrow(new Error(ERROR_REASONS.IDS_REQUIRED));
      expect(query).not.toHaveBeenCalled();
    }
  );
  it.each([['9007199254740993'], [1, 2]])(
    'preserves valid IDs %p without numeric coercion',
    async (...ids) => {
      const result = { data: [], status: { error_code: 'Success' } };
      const query = jest.fn().mockResolvedValue(result);
      const client = { query } as unknown as MilvusClient;
      const request = { collection_name: 'validation', ids } as GetReq;
      expect(await MilvusClient.prototype.get.call(client, request)).toBe(
        result
      );
      expect(query).toHaveBeenCalledWith(request);
    }
  );
});
