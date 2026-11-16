// Exercise the implementation Jest actually resolves, including nested installs.
const merge: typeof import('deepmerge') = require(
  require.resolve('deepmerge', {
    paths: [require.resolve('jest-config')],
  })
);

describe('Jest configuration merge security', () => {
  const payload = () =>
    JSON.parse('{"__proto__":{"injected":true},"safe":true}');

  const expectSafe = (value: Record<string, unknown>) => {
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(value.injected).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(value, '__proto__')).toBe(
      false
    );
    expect(value.safe).toBe(true);
  };

  it('rejects prototype keys when the target has no prototype', () => {
    expectSafe(merge(Object.create(null), payload()));
  });

  it.each([null, undefined, false, 0, ''])(
    'rejects prototype keys merged into a %p placeholder',
    placeholder => {
      expectSafe(
        merge({ session: placeholder }, { session: payload() }).session
      );
    }
  );

  it('rejects prototype keys copied from either operand', () => {
    expectSafe(merge(payload(), {}));
    expectSafe(merge(payload(), payload()));
    expectSafe(merge({ list: [] }, { list: [payload()] }).list[0]);
  });

  it('preserves nested configuration merging and array concatenation', () => {
    const preset = { globals: { enabled: true, paths: ['preset'] } };
    const config = { globals: { timeout: 100, paths: ['project'] } };
    expect(merge(preset, config)).toEqual({
      globals: {
        enabled: true,
        timeout: 100,
        paths: ['preset', 'project'],
      },
    });
    expect(preset.globals.paths).toEqual(['preset']);
    expect(config.globals.paths).toEqual(['project']);
  });
});
