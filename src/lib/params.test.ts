import { describe, expect, test } from 'vitest';
import { DATA_TYPE, OPERATORS } from './constants';
import {
  filtersObjectToArray,
  hasUnsafeFilterNames,
  InvalidFilterError,
  parseSessionPropertyFilters,
  parseUniversalEventPropertyFilters,
  serializeSessionPropertyFilters,
  serializeUniversalEventPropertyFilters,
} from './params';

describe('session property filter params', () => {
  test('serializes and parses session property filters', () => {
    const filters = [
      {
        propertyName: 'user.id',
        dataType: DATA_TYPE.string,
        operator: OPERATORS.equals,
        value: 'abc.123,xyz',
      },
      {
        propertyName: 'created at',
        dataType: DATA_TYPE.date,
        operator: OPERATORS.before,
        value: '2026-07-01',
      },
    ];

    const params = serializeSessionPropertyFilters(filters);

    expect(params).toEqual({
      spf0: '1.eq.user%2Eid.abc.123,xyz',
      spf1: '4.bf.created%20at.2026-07-01',
    });
    expect(parseSessionPropertyFilters(params)).toEqual(filters);
  });

  test('ignores malformed session property filters', () => {
    expect(
      parseSessionPropertyFilters({
        spf0: 'eq.user%2Eid.value',
        spf1: '1.unknown.email.value',
        spf2: '1.eq',
      }),
    ).toEqual([]);
  });

  test('serializes and parses universal event property filters', () => {
    const filters = [
      {
        propertyName: 'plan.id',
        dataType: DATA_TYPE.string,
        operator: OPERATORS.equals,
        value: 'pro,team',
      },
    ];

    const params = serializeUniversalEventPropertyFilters(filters);

    expect(params).toEqual({
      epf0: '1.eq.plan%2Eid.pro,team',
    });
    expect(parseUniversalEventPropertyFilters(params)).toEqual(filters);
  });

  test('ignores malformed universal event property filters', () => {
    expect(
      parseUniversalEventPropertyFilters({
        epf0: 'eq.plan%2Eid.value',
        epf1: '1.unknown.email.value',
        epf2: '1.eq',
      }),
    ).toEqual([]);
  });
});

describe('filter names are plain words (SQL injection hardening)', () => {
  const bad = [
    'x or 1=1 --',
    'path1 ilike 1 or (select 1) --',
    'a}} or (select 1) --',
    '{{x}}',
    "a'b",
    '',
  ];

  test('filtersObjectToArray rejects unsafe paramName, name and key', () => {
    for (const value of bad) {
      expect(() =>
        filtersObjectToArray({ path: { name: 'path', value: 'a', operator: 'c', paramName: value } }),
      ).toThrow(InvalidFilterError);
      if (value) {
        expect(() =>
          filtersObjectToArray({ path: { name: value, value: 'a', operator: 'c' } }),
        ).toThrow(InvalidFilterError);
      }
      if (value) {
        expect(() => filtersObjectToArray({ [value]: 'eq.a' })).toThrow(InvalidFilterError);
      }
    }
  });

  test('a request-supplied prefix is dropped', () => {
    const [f] = filtersObjectToArray({
      path: { name: 'path', value: 'a', operator: 'c', prefix: 'x; select 1 --' },
    });
    expect(f.prefix).toBeUndefined();
  });

  test('plain filters still work', () => {
    const arr = filtersObjectToArray({ path: 'c.docs', browser1: 'eq.chrome' });
    expect(arr.map(f => f.name)).toEqual(['path', 'browser']);
    expect(arr[1].paramName).toBe('browser1');
  });

  test('hasUnsafeFilterNames flags request bodies and passes clean ones', () => {
    for (const value of bad) {
      expect(
        hasUnsafeFilterNames({ filters: { path: { name: 'path', value: 'a', paramName: value } } }),
      ).toBe(true);
    }
    expect(hasUnsafeFilterNames({ filters: { 'a or 1': 'eq.x' } })).toBe(true);
    expect(hasUnsafeFilterNames({ filters: { path: 'c.x', browser1: 'eq.y' }, unit: 'day' })).toBe(false);
  });
});
