import { restOperations } from '../../docs/src/lib/rest-catalog';
import bindings from '../../docs/src/lib/rest-bindings.json';
import sdk from '../../package.json';

describe('REST reference catalog', () => {
  it('documents each route in the pinned Milvus router exactly once', () => {
    expect(bindings.milvusVersion).toBe(sdk.milvusVersion);
    const expected = Object.keys(bindings.routes).map(
      route => '/v2/vectordb' + route
    );
    expect(restOperations.map(op => op.path).sort()).toEqual(expected.sort());
    const slugs = restOperations.map(op => op.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const sections = new Map(
      restOperations.map(op => [op.group, op.slug.split('/')[0]])
    );
    expect(new Set(sections.values()).size).toBe(sections.size);
    for (const op of restOperations)
      expect(op.slug.split('/')[0]).toBe(sections.get(op.group));
  });

  it('provides a typed example for each mandatory top-level field', () => {
    for (const op of restOperations) {
      const fields = new Map(op.fields.map(field => [field.name, field]));
      for (const f of op.fields.filter(field => field.required)) {
        expect(op.request).toHaveProperty(f.name);
      }
      for (const [key, value] of Object.entries(op.request)) {
        const f = fields.get(key);
        if (!f)
          throw new Error('Undocumented example field: ' + op.path + ' ' + key);
        if (f.type.startsWith('array')) expect(Array.isArray(value)).toBe(true);
        else if (f.type === 'integer')
          expect(Number.isInteger(value)).toBe(true);
        else if (f.type !== 'JSON value') expect(typeof value).toBe(f.type);
      }
    }
  });
});
