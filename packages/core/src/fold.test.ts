import { describe, expect, it } from 'vitest';
import { token } from './token';
import { assertFoldSlots, type FoldSlot } from './fold';

/** A minimal well-formed slot — key + view token + a thunk onto its own child VM. */
const slot = (key: string): FoldSlot => ({
  key,
  viewToken: token<unknown>(`view.${key}`),
  slotVm: () => ({ key }),
});

describe('assertFoldSlots', () => {
  it('accepts 1 slot', () => {
    expect(() => assertFoldSlots([slot('a')])).not.toThrow();
  });

  it('accepts 3 slots', () => {
    expect(() => assertFoldSlots([slot('a'), slot('b'), slot('c')])).not.toThrow();
  });

  it('rejects 0 slots', () => {
    expect(() => assertFoldSlots([])).toThrow(RangeError);
  });

  // The ceiling of three is a deliberate constraint, not a bug: the
  // fold ships with two slots and exactly one spare.
  it('rejects more than 3 slots', () => {
    expect(() => assertFoldSlots([slot('a'), slot('b'), slot('c'), slot('d')])).toThrow(RangeError);
  });

  it('rejects duplicate keys', () => {
    expect(() => assertFoldSlots([slot('a'), slot('a')])).toThrow(/duplicate/i);
  });
});
