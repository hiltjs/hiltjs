import { describe, expect, it } from 'vitest';

import { ValidationCode, all, any, matches, not, type Spec } from './validation';

/** A spec that is satisfied for exactly one value, and fails with `code` otherwise. */
const only = (value: string, code: string): Spec => ({
  validate: (candidate) => (candidate === value ? null : { code }),
});

const A = only('a', 'fail.a');
const B = only('b', 'fail.b');

describe('all — AND, first failure wins', () => {
  it('is satisfied when every spec is', () => {
    expect(all(A, A).validate('a')).toBeNull();
  });

  it('returns the FIRST failure and short-circuits (the denial reason is the leading one)', () => {
    expect(all(A, B).validate('z')).toEqual({ code: 'fail.a' });
    expect(all(B, A).validate('z')).toEqual({ code: 'fail.b' });
  });

  it('is satisfied with no specs (the empty conjunction)', () => {
    expect(all().validate('anything')).toBeNull();
  });
});

// `any` is what lets a rule have two independent ways through — the composition
// behind "your own conversation OR you supervise the agent holding it". Its
// failure semantics are the mirror of `all`'s and are load-bearing: a caller
// that is denied on BOTH branches gets the LAST spec's code, so argument order
// decides which reason surfaces.
describe('any — OR, last failure wins', () => {
  it('is satisfied when the FIRST spec is, without evaluating the rest', () => {
    let touched = false;
    const tripwire: Spec = {
      validate: () => {
        touched = true;
        return { code: 'fail.tripwire' };
      },
    };
    expect(any(A, tripwire).validate('a')).toBeNull();
    expect(touched).toBe(false);
  });

  it('is satisfied when a LATER spec is', () => {
    expect(any(A, B).validate('b')).toBeNull();
  });

  it('returns the LAST failure when every branch denies', () => {
    expect(any(A, B).validate('z')).toEqual({ code: 'fail.b' });
    expect(any(B, A).validate('z')).toEqual({ code: 'fail.a' });
  });

  it('is satisfied with no specs (documented: zero specs → satisfied)', () => {
    expect(any().validate('anything')).toBeNull();
  });
});

describe('not — negation needs its own code', () => {
  it('is satisfied when the negated spec FAILS', () => {
    expect(not(A, 'fail.notA').validate('z')).toBeNull();
  });

  it('fails with the supplied code when the negated spec is satisfied', () => {
    expect(not(A, 'fail.notA').validate('a')).toEqual({ code: 'fail.notA', params: undefined });
  });

  it('carries interpolation params through', () => {
    expect(not(A, 'fail.notA', { n: 1 }).validate('a')?.params).toEqual({ n: 1 });
  });

  it('composes back to the original under double negation', () => {
    const doubled = not(not(A, 'x'), 'y');
    expect(doubled.validate('a')).toBeNull();
    expect(doubled.validate('z')).toEqual({ code: 'y', params: undefined });
  });
});

describe('matches — the trimmed shape check', () => {
  it('trims before testing', () => {
    expect(matches(/^\d{6}$/).validate('  123456  ')).toBeNull();
  });

  it('defaults to the Pattern code and honours an override + params', () => {
    expect(matches(/^\d{6}$/).validate('12345')).toEqual({
      code: ValidationCode.Pattern,
      params: undefined,
    });
    expect(matches(/^\d{6}$/, 'code.custom', { length: 6 }).validate('nope')).toEqual({
      code: 'code.custom',
      params: { length: 6 },
    });
  });
});
