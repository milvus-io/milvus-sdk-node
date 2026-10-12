import {
  formatNumberPrecision,
  parseToKeyValue,
  formatKeyValueData,
  stringToBase64,
  formatAddress,
  hybridtsToUnixtime,
  unixtimeToHybridts,
  datetimeToHybrids,
  checkSearchParams,
  parseTimeToken,
  extractMethodName,
  ERROR_REASONS,
  cloneObj,
  logger,
  normalizeOrderByFields,
} from '../../milvus';

describe('utils/format', () => {
  it(`all kinds of url should be supported`, async () => {
    const port = `80980`;
    const urlWithHttps = `https://my-url:${port}`;
    expect(formatAddress(urlWithHttps)).toBe(`my-url:${port}`);

    const urlWithHttp = `https://my-url:${port}`;
    expect(formatAddress(urlWithHttp)).toBe(`my-url:${port}`);

    const urlWithoutHttp = `my-url`;
    expect(formatAddress(urlWithoutHttp)).toBe(`my-url`);

    const urlWithoutHttpCustomPort = `my-url:12345`;
    expect(formatAddress(urlWithoutHttpCustomPort)).toBe(`my-url:12345`);

    const urlWithEmpty = `://my-url`;
    expect(formatAddress(urlWithEmpty)).toBe(`my-url`);

    const urlWithEmptyCustomPort = `://my-url:12345`;
    expect(formatAddress(urlWithEmptyCustomPort)).toBe(`my-url:12345`);
  });

  it(`should warn when no port is specified in address`, () => {
    const warnSpy = jest.spyOn(logger, 'warn');

    formatAddress('my-url');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No port specified')
    );

    warnSpy.mockClear();
    formatAddress('http://my-url');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No port specified')
    );

    warnSpy.mockClear();
    formatAddress('https://my-url');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No port specified')
    );

    warnSpy.mockRestore();
  });

  it(`should not warn when port is specified in address`, () => {
    const warnSpy = jest.spyOn(logger, 'warn');

    formatAddress('my-url:19530');
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockClear();
    formatAddress('https://my-url:443');
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it(`should convert string to base64 encoding`, () => {
    const testString = 'hello world, I love milvus';
    const str = stringToBase64(testString);
    expect(str.length % 4 == 0 && /^[A-Za-z0-9+/]+[=]{0,2}$/.test(str)).toBe(
      true
    );
  });

  it(`should convert [{key:"row_count",value:4}] to {row_count:4}`, () => {
    const testValue = [{ key: 'row_count', value: 4 }];
    const res = formatKeyValueData(testValue, ['row_count']);
    expect(res).toMatchObject({ row_count: 4 });
  });

  it(`should convert  {row_count:4} t0 [{key:"row_count",value:4}]`, () => {
    const testValue = { row_count: 4, b: 3 };
    const res = parseToKeyValue(testValue);
    expect(res).toMatchObject([
      { key: 'row_count', value: 4 },
      { key: 'b', value: 3 },
    ]);
  });

  it(`should convert  {row_count:4, b: 3} t0 [{key:"row_count",value:'4'}, {key: "b", value: '4'}]`, () => {
    const testValue = { row_count: '4', b: 3 };
    const res = parseToKeyValue(testValue, true);
    expect(res).toMatchObject([
      { key: 'row_count', value: '4' },
      { key: 'b', value: '3' },
    ]);
  });

  it(`should serialize complex data types (objects/arrays) to JSON strings when valueToString is true`, () => {
    const testValue = {
      simple: 'string',
      number: 42,
      object: { nested: 'value', count: 5 },
      array: [1, 2, 3],
      nullValue: null,
    };
    const res = parseToKeyValue(testValue, true);
    expect(res).toMatchObject([
      { key: 'simple', value: 'string' },
      { key: 'number', value: '42' },
      { key: 'object', value: '{"nested":"value","count":5}' },
      { key: 'array', value: '[1,2,3]' },
      { key: 'nullValue', value: 'null' },
    ]);
  });

  it(`should normalize order by fields`, () => {
    expect(normalizeOrderByFields()).toBeUndefined();
    expect(normalizeOrderByFields(null as any)).toBeUndefined();
    expect(normalizeOrderByFields('price:asc,rating:desc')).toBe(
      'price:asc,rating:desc'
    );
    expect(
      normalizeOrderByFields([
        'price:asc',
        { field: 'rating', order: 'desc' },
        { field: 'stock' },
      ])
    ).toBe('price:asc,rating:desc,stock:asc');
  });

  it(`should reject invalid order by fields`, () => {
    expect(() => normalizeOrderByFields({ field: 'price' } as any)).toThrow(
      'Invalid order_by_fields format'
    );
    expect(() => normalizeOrderByFields([{ order: 'desc' } as any])).toThrow(
      'field'
    );
    expect(() => normalizeOrderByFields([1 as any])).toThrow(
      'Invalid order_by_fields item format'
    );
  });

  it(`should convert [{key:"row_count",value:4}] to {row_count:4}`, () => {
    const testValue = 3.1231241241234124124;
    const res = formatNumberPrecision(testValue, 3);
    expect(res).toBe(3.123);

    const testValue2 = -3.1231241241234124124;
    const res2 = formatNumberPrecision(testValue2, 3);
    expect(res2).toBe(-3.123);
  });

  it(`hybridtsToUnixtime should success`, async () => {
    let unixtime = hybridtsToUnixtime('429642767925248000');
    expect(unixtime).toEqual('1638957092');
  });

  it(`hybridtsToUnixtime should throw error`, async () => {
    try {
      hybridtsToUnixtime(1 as any);
    } catch (error) {
      expect(error.message).toContain(ERROR_REASONS.TIMESTAMP_PARAM_CHECK);
    }
  });

  it(`unixtimeToHybridts should success`, async () => {
    let unixtime = unixtimeToHybridts('1638957092');
    expect(unixtime).toEqual('429642767925248000');
  });

  it(`unixtimeToHybridts should throw error`, async () => {
    try {
      unixtimeToHybridts(1 as any);
    } catch (error) {
      expect(error.message).toContain(ERROR_REASONS.TIMESTAMP_PARAM_CHECK);
    }

    try {
      unixtimeToHybridts('asd');
    } catch (error) {
      expect(error.message).toContain(ERROR_REASONS.TIMESTAMP_PARAM_CHECK);
    }
  });

  it(`datetimeToHybrids should success`, async () => {
    let unixtime = datetimeToHybrids(new Date(1638957092 * 1000));
    expect(unixtime).toEqual('429642767925248000');
  });

  it(`datetimeToHybrids should throw error`, async () => {
    try {
      datetimeToHybrids(1 as any);
    } catch (error) {
      expect(error.message).toContain(ERROR_REASONS.DATE_TYPE_CHECK);
    }
  });

  it(`datetimeToHybrids should keep the milliseconds of a Date`, async () => {
    // hybridts = physical time in milliseconds << 18
    const ms = Date.parse('2024-01-01T00:00:00.500Z');
    const expected = (BigInt(ms) << BigInt(18)).toString();
    expect(datetimeToHybrids(new Date('2024-01-01T00:00:00.500Z'))).toEqual(
      expected
    );
    expect(datetimeToHybrids(new Date('2024-01-01T00:00:00.500Z'))).toEqual(
      '446710992207872000'
    );
    expect(datetimeToHybrids(new Date('2024-01-01T12:34:56.789Z'))).toEqual(
      '446722866358255616'
    );

    // a whole-second Date is unchanged
    expect(datetimeToHybrids(new Date('2024-01-01T00:00:00.000Z'))).toEqual(
      '446710992076800000'
    );

    // the milliseconds are the only difference, 1 ms = 2^18
    expect(
      BigInt(datetimeToHybrids(new Date('2024-01-01T00:00:00.001Z'))) -
        BigInt(datetimeToHybrids(new Date('2024-01-01T00:00:00.000Z')))
    ).toEqual(BigInt(1) << BigInt(18));

    // round trip back to unix seconds (floored)
    expect(
      hybridtsToUnixtime(
        datetimeToHybrids(new Date('2024-01-01T12:34:56.789Z'))
      )
    ).toEqual('1704112496');
  });

  it(`datetimeToHybrids should throw error for an invalid Date`, async () => {
    expect(() => datetimeToHybrids(new Date('not a date'))).toThrow(
      ERROR_REASONS.TIMESTAMP_PARAM_CHECK
    );
  });

  it(`unixtimeToHybridts should floor fractional seconds`, async () => {
    expect(unixtimeToHybridts('1704067200.5')).toEqual('446710992076800000');
    expect(unixtimeToHybridts('1704067200.999')).toEqual('446710992076800000');
    expect(unixtimeToHybridts('1704067200.0')).toEqual('446710992076800000');
    expect(() => unixtimeToHybridts('Infinity')).toThrow(
      ERROR_REASONS.TIMESTAMP_PARAM_CHECK
    );
  });

  it(`unixtimeToHybridts should keep whole-second results unchanged`, async () => {
    expect(unixtimeToHybridts('1638957092')).toEqual('429642767925248000');
    expect(unixtimeToHybridts(BigInt(1638957092))).toEqual(
      '429642767925248000'
    );
    expect(unixtimeToHybridts('1704067200')).toEqual('446710992076800000');
    expect(unixtimeToHybridts('0')).toEqual('0');
    expect(unixtimeToHybridts('-5')).toEqual('-1310720000');
  });
  it('parses time tokens correctly', () => {
    expect(parseTimeToken('1s')).toBe(1000);
    expect(parseTimeToken('2m')).toBe(120000);
    expect(parseTimeToken('3h')).toBe(10800000);
    expect(parseTimeToken('4d')).toBe(345600000);
    expect(parseTimeToken('1w')).toBe(604800000);
    expect(parseTimeToken('1M')).toBe(2592000000);
    expect(parseTimeToken('1Y')).toBe(31536000000);
  });

  it('throws an error for invalid time tokens', () => {
    expect(() => parseTimeToken('')).toThrow('Invalid time token: ');
    expect(() => parseTimeToken('1')).toThrow('Invalid time token: 1');
    expect(() => parseTimeToken('1x')).toThrow('Invalid time token: 1x');
  });

  it('does not throw an error if vectors or vector is defined', () => {
    const data1 = {
      collection_name: 'my_collection',
      data: [[]],
    };

    const data2 = {
      collection_name: 'my_collection',
      data: [],
    };

    expect(() => checkSearchParams(data1)).not.toThrow();
    expect(() => checkSearchParams(data2)).not.toThrow();
  });

  it('extracts the method name from a URL path', () => {
    const query = '/api/v1/users/123';
    const methodName = extractMethodName(query);
    expect(methodName).toBe('123');
  });

  it('cloneObj should create a deep copy of the object', () => {
    const obj = { a: 1, b: { c: 2 } };
    const clonedObj = cloneObj(obj);
    expect(clonedObj).toEqual(obj);
    expect(clonedObj).not.toBe(obj);
    expect(clonedObj.b).toEqual(obj.b);
    expect(clonedObj.b).not.toBe(obj.b);
  });
});
