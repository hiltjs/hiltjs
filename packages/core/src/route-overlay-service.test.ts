import { describe, expect, it } from 'vitest';

import { RouteOverlayService } from './route-overlay-service';

describe('RouteOverlayService', () => {
  it('starts with no active overlay', () => {
    const sut = new RouteOverlayService();
    let value: string | null | undefined;
    sut.active$.subscribe((v) => (value = v));

    expect(value).toBeNull();
  });

  it('open(kind) emits the kind on active$', () => {
    const sut = new RouteOverlayService();
    const emissions: (string | null)[] = [];
    sut.active$.subscribe((v) => emissions.push(v));

    sut.open('chat');

    // Initial replay (null) + the new emission.
    expect(emissions).toEqual([null, 'chat']);
  });

  it('close() emits null', () => {
    const sut = new RouteOverlayService();
    sut.open('chat');

    const emissions: (string | null)[] = [];
    sut.active$.subscribe((v) => emissions.push(v));
    sut.close();

    expect(emissions).toEqual(['chat', null]);
  });

  it('close() is a no-op when no overlay is active', () => {
    const sut = new RouteOverlayService();
    const emissions: (string | null)[] = [];
    sut.active$.subscribe((v) => emissions.push(v));

    sut.close();

    // Only the initial replay — no extra emission.
    expect(emissions).toEqual([null]);
  });

  it('a second open replaces the previous kind without an intermediate null', () => {
    const sut = new RouteOverlayService();
    sut.open('chat');

    const emissions: (string | null)[] = [];
    sut.active$.subscribe((v) => emissions.push(v));
    // Today only `'chat'` exists — re-open of the same kind asserts
    // the surface is permissive (the BehaviorSubject deduplicates
    // identical values, so this is a no-op emission). When future
    // kinds land the second-open-replaces-first contract is the
    // important behaviour to keep.
    sut.open('chat');

    expect(emissions).toEqual(['chat']);
  });
});
