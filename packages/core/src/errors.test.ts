import { describe, expect, it } from 'vitest';

import { type AppError, ErrorCollection, Fail, Ok, type OperationResult } from './index';

const sample = (overrides: Partial<AppError> = {}): AppError => ({
  code: 'TEST.SAMPLE',
  message: 'sample',
  severity: 'error',
  ...overrides,
});

describe('ErrorCollection', () => {
  it('empty() returns the same singleton', () => {
    expect(ErrorCollection.empty()).toBe(ErrorCollection.empty());
    expect(ErrorCollection.empty().isEmpty()).toBe(true);
    expect(ErrorCollection.empty().errors).toHaveLength(0);
  });

  it('of() creates a collection with the given errors', () => {
    const a = sample({ code: 'A' });
    const b = sample({ code: 'B' });
    const coll = ErrorCollection.of(a, b);
    expect(coll.errors).toEqual([a, b]);
    expect(coll.hasErrors()).toBe(true);
  });

  it('of() with no args returns empty singleton', () => {
    expect(ErrorCollection.of()).toBe(ErrorCollection.empty());
  });

  it('add() returns a new instance, original unchanged', () => {
    const original = ErrorCollection.of(sample({ code: 'A' }));
    const next = original.add(sample({ code: 'B' }));
    expect(original.errors).toHaveLength(1);
    expect(next.errors).toHaveLength(2);
    expect(next).not.toBe(original);
  });

  it('merge() concatenates, preserves order, returns same instance when one side is empty', () => {
    const empty = ErrorCollection.empty();
    const a = ErrorCollection.of(sample({ code: 'A' }));
    const b = ErrorCollection.of(sample({ code: 'B' }));
    expect(a.merge(empty)).toBe(a);
    expect(empty.merge(a)).toBe(a);
    const merged = a.merge(b);
    expect(merged.errors.map((e) => e.code)).toEqual(['A', 'B']);
  });

  it('byField() filters by exact field match', () => {
    const coll = ErrorCollection.of(
      sample({ code: 'A', field: 'email' }),
      sample({ code: 'B', field: 'email' }),
      sample({ code: 'C', field: 'name' }),
    );
    expect(coll.byField('email').map((e) => e.code)).toEqual(['A', 'B']);
    expect(coll.byField('name').map((e) => e.code)).toEqual(['C']);
    expect(coll.byField('missing')).toHaveLength(0);
  });

  it('bySeverity() filters by severity level', () => {
    const coll = ErrorCollection.of(
      sample({ code: 'A', severity: 'warning' }),
      sample({ code: 'B', severity: 'error' }),
      sample({ code: 'C', severity: 'critical' }),
      sample({ code: 'D', severity: 'fatal' }),
    );
    expect(coll.bySeverity('warning').map((e) => e.code)).toEqual(['A']);
    expect(coll.bySeverity('fatal').map((e) => e.code)).toEqual(['D']);
  });

  it('hasCritical() is true for critical OR fatal', () => {
    expect(ErrorCollection.of(sample({ severity: 'warning' })).hasCritical()).toBe(false);
    expect(ErrorCollection.of(sample({ severity: 'error' })).hasCritical()).toBe(false);
    expect(ErrorCollection.of(sample({ severity: 'critical' })).hasCritical()).toBe(true);
    expect(ErrorCollection.of(sample({ severity: 'fatal' })).hasCritical()).toBe(true);
  });

  it('fromException() wraps Error and unknown values', () => {
    const errOnly = ErrorCollection.fromException(new Error('boom'));
    expect(errOnly.errors).toHaveLength(1);
    const errors = [...errOnly.errors];
    expect(errors[0]?.message).toBe('boom');
    expect(errors[0]?.code).toBe('UNEXPECTED');
    expect(errors[0]?.cause).toBeInstanceOf(Error);

    const stringErr = ErrorCollection.fromException('string failure', 'CUSTOM');
    expect(stringErr.errors[0]?.message).toBe('string failure');
    expect(stringErr.errors[0]?.code).toBe('CUSTOM');
  });

  it('toJSON() omits cause and undefined optional fields', () => {
    const cause = new Error('inner');
    const coll = ErrorCollection.of(
      sample({ code: 'A', field: 'email', cause }),
      sample({ code: 'B', metadata: { foo: 'bar' } }),
    );
    const json = coll.toJSON();
    expect(json).toEqual([
      { code: 'A', message: 'sample', severity: 'error', field: 'email' },
      { code: 'B', message: 'sample', severity: 'error', metadata: { foo: 'bar' } },
    ]);
  });

  it('isEmpty / hasErrors are mutually exclusive', () => {
    expect(ErrorCollection.empty().isEmpty()).toBe(true);
    expect(ErrorCollection.empty().hasErrors()).toBe(false);
    const one = ErrorCollection.of(sample());
    expect(one.isEmpty()).toBe(false);
    expect(one.hasErrors()).toBe(true);
  });
});

describe('OperationResult helpers', () => {
  it('Ok() wraps a value', () => {
    const result: OperationResult<number> = Ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it('Fail() wraps an ErrorCollection', () => {
    const errors = ErrorCollection.of(sample());
    const result: OperationResult<number> = Fail(errors);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toBe(errors);
  });
});
