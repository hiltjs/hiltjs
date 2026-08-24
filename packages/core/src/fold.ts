import type { Token } from './token';

import type { Command } from './command';
import type { ReactiveProperty } from './reactive-property';
import type { ViewModel } from './view-model';

/** One slot of a {@link IFoldViewModel}: declared BY THE VM, not by a registry const inside the shell. */
export type FoldSlot = {
  /** Stable identity for this slot; unique within the collection. */
  readonly key: string;
  /** DI token resolving to this slot's view. */
  readonly viewToken: Token<unknown>;
  /** This slot's own child view-model, resolved at render time. */
  readonly slotVm: () => unknown;
};

/** MVVM contract for a generic `Fold`: a VM that declares a collection of 1–3 slots and how many are currently revealed. */
export interface IFoldViewModel extends ViewModel {
  /** The slot collection to show. */
  readonly slots: readonly FoldSlot[];
  /** How many slots are revealed. */
  readonly revealedCount: ReactiveProperty<number>;
  /** How far into {@link slots} the VM will currently let the viewer expand: the reveal CEILING. */
  readonly revealableCount: ReactiveProperty<number>;
  /** Reveal the next slot; no-op once {@link revealableCount} slots are revealed. */
  readonly expandNext: Command;
  /** Hide the last revealed slot; no-op once only the first slot remains (the fold always shows at least one). */
  readonly collapsePrevious: Command;
}

/** Enforce the fold slot invariant in exactly one place: a collection has at least one and at most three slots, with unique keys. */
export function assertFoldSlots(slots: readonly FoldSlot[]): void {
  if (slots.length < 1 || slots.length > 3) {
    throw new RangeError(`Fold requires 1–3 slots, got ${slots.length}`);
  }
  const keys = new Set(slots.map((s) => s.key));
  if (keys.size !== slots.length) {
    throw new Error('Fold slots must have duplicate-free keys');
  }
}
