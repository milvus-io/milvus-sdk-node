import {
  CreateCollectionWithFieldsReq,
  FieldData,
  MilvusClient,
  ERROR_REASONS,
} from '../../milvus';
import { generateInsertData } from '../fixtures';
import { expectFailureStatus } from '../support/assertions';

/** Mutate one valid row at a time so another missing field cannot mask the intended failure. */
export function mutationValidationCases(options: {
  client: MilvusClient;
  collection: string;
  schema: CreateCollectionWithFieldsReq;
  operation: 'insert' | 'upsert';
  partition?: string;
}) {
  const cases = [
    {
      name: 'missing required scalar',
      outcome: 'status',
      reason: /int64/i,
      mutate: (row: Record<string, FieldData>) => {
        delete row.int64;
      },
    },
    {
      name: 'unknown field',
      outcome: 'rejection',
      reason: /some field does not exist/,
      mutate: (row: Record<string, FieldData>) => {
        row.unknown_field = 1;
      },
    },
    {
      name: 'wrong vector dimension',
      outcome: 'status',
      reason: /dim|vector/i,
      mutate: (row: Record<string, FieldData>) => {
        row.vector = [0.1, 0.2, 0.3];
      },
    },
  ];
  it.each(cases)(
    `${options.operation} rejects $name without accepting rows`,
    async fixture => {
      const row = generateInsertData(options.schema.fields, 1)[0];
      fixture.mutate(row);
      const request = options.client[options.operation]({
        collection_name: options.collection,
        partition_name: options.partition,
        data: [row],
      });
      if (fixture.outcome === 'rejection')
        await expect(request).rejects.toThrow(
          ERROR_REASONS.INSERT_CHECK_WRONG_FIELD
        );
      else {
        const result = await request;
        expectFailureStatus(result, fixture.reason);
        expect(result.succ_index).toEqual([]);
        expect(Number(result.insert_cnt)).toBe(0);
        expect(result.err_index).toEqual([0]);
      }
    }
  );
}
