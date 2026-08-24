import { describe, expect, it, vi } from 'vitest';

import { ReactiveProperty } from './reactive-property';

describe('ReactiveProperty', () => {
  it('starts with the initial value', () => {
    const prop = new ReactiveProperty(42);
    expect(prop.value).toBe(42);
  });

  it('value setter emits on changes$', () => {
    const prop = new ReactiveProperty(0);
    const observed: number[] = [];
    prop.changes$.subscribe((v) => observed.push(v));
    prop.value = 1;
    prop.value = 2;
    expect(observed).toEqual([0, 1, 2]); // BehaviorSubject emits current on subscribe
  });

  it('skips emission when next value is identical (Object.is, default)', () => {
    const prop = new ReactiveProperty('a');
    const handler = vi.fn();
    prop.changes$.subscribe(handler);
    handler.mockClear();
    prop.value = 'a';
    expect(handler).not.toHaveBeenCalled();
    prop.value = 'b';
    expect(handler).toHaveBeenCalledWith('b');
  });

  it('honors a custom equals function', () => {
    type V = { id: number };
    const prop = new ReactiveProperty<V>({ id: 1 }, { equals: (a, b) => a.id === b.id });
    const handler = vi.fn();
    prop.changes$.subscribe(handler);
    handler.mockClear();
    prop.value = { id: 1 }; // same id → no emit
    expect(handler).not.toHaveBeenCalled();
    prop.value = { id: 2 };
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('distinct: false emits even when value is unchanged', () => {
    const prop = new ReactiveProperty(0, { distinct: false });
    const handler = vi.fn();
    prop.changes$.subscribe(handler);
    handler.mockClear();
    prop.value = 0;
    prop.value = 0;
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('set(next) is equivalent to value = next', () => {
    const prop = new ReactiveProperty(0);
    prop.set(7);
    expect(prop.value).toBe(7);
  });

  it('update(fn) applies the updater to the current value', () => {
    const prop = new ReactiveProperty(10);
    prop.update((n) => n + 5);
    expect(prop.value).toBe(15);
  });

  it('complete() makes future writes silent no-ops', () => {
    const prop = new ReactiveProperty(0);
    const handler = vi.fn();
    prop.changes$.subscribe(handler);
    prop.complete();
    handler.mockClear();
    prop.value = 99;
    expect(handler).not.toHaveBeenCalled();
    expect(prop.value).toBe(0); // last value preserved
  });

  it('complete() is idempotent', () => {
    const prop = new ReactiveProperty(0);
    prop.complete();
    expect(() => {
      prop.complete();
    }).not.toThrow();
  });
});
