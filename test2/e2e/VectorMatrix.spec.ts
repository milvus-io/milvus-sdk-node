import { DataType } from '../../milvus';
import { vectorCases } from '../fixtures/vectors';
import { vectorScenario } from '../scenarios/vector';

describe.each([
  { name: 'Int64 primary key', type: DataType.Int64 as const },
  { name: 'VarChar primary key', type: DataType.VarChar as const },
])('$name / wide mixed schema', primary => {
  it.each(vectorCases)('$name lifecycle', fixture =>
    vectorScenario(fixture, primary.type)
  );
});
