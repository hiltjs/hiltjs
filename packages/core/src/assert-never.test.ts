import { describe, expect, it } from 'vitest';

import { assertNever } from './assert-never';

describe('assertNever · exhaustiveness', () => {
  it('throws when reached at runtime (the unreachable default arm)', () => {
    // The compiler proves this is unreachable; at runtime a malformed value
    // (e.g. an unknown discriminant off the wire) must still fail loudly.
    const rogue = 'unexpected' as never;
    expect(() => assertNever(rogue)).toThrowError();
  });

  it('includes the offending value in the message for diagnosis', () => {
    const rogue = 'OddArm' as never;
    expect(() => assertNever(rogue)).toThrowError(/OddArm/);
  });
});
