import { describe, expect, it } from 'vitest';
import { isNavigationAware, navTarget } from './navigation';

describe('navTarget', () => {
  it('carries its stable key', () => {
    const t = navTarget<{ id: string }>('conversation.detail');
    expect(t.key).toBe('conversation.detail');
  });
});

describe('isNavigationAware', () => {
  it('is true when the object has an onNavigatedTo method', () => {
    const vm = { onNavigatedTo() {} };
    expect(isNavigationAware(vm)).toBe(true);
  });
  it('is false otherwise', () => {
    expect(isNavigationAware({})).toBe(false);
    expect(isNavigationAware(null)).toBe(false);
  });
});
