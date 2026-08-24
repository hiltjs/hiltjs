import type { Token } from './token';

import type { Command } from './command';
import type { ReactiveProperty } from './reactive-property';
import type { ViewModel } from './view-model';

/**
 * One slot of a {@link IFoldViewModel} — declared BY THE VM, not
 * by a registry const inside the shell. A slot carries three things:
 *
 *   - `key` — identity (and, by array position, order);
 *   - `viewToken` — the DI token the fold resolves to get this slot's VIEW, so
 *     replacing a slot's implementation is a *registration* change and the shell
 *     never names a slot's component;
 *   - `slotVm` — a thunk onto this slot's OWN child view-model.
 *
 * `slotVm` is a FUNCTION, not a value, and that is load-bearing: a fold's child
 * may be rebuilt while the fold stays mounted (a master–detail fold rebuilds its
 * detail child on every selection change, and it is `null` before the first
 * selection). A slot declaration is static; the child it points at is not. The thunk
 * is evaluated at render time, so the slot view always receives the CURRENT
 * child — and never the parent fold VM.
 *
 * Both are typed `unknown` here on purpose: this package is the UI-framework-free
 * MVVM kernel and must not name React's `ViewComponent`. The React `FoldView`
 * narrows once, at the single point where the token is resolved.
 */
export type FoldSlot = {
  /** Stable identity for this slot; unique within the collection. */
  readonly key: string;
  /**
   * DI token resolving to this slot's view. Declared as `Token<ViewComponent<TSlotVm>>`
   * at the (React-aware) token-declaration site; opaque here.
   */
  readonly viewToken: Token<unknown>;
  /** This slot's own child view-model, resolved at render time. */
  readonly slotVm: () => unknown;
};

/**
 * MVVM contract for a generic `Fold`: a VM that declares a collection of 1–3
 * slots and how many are currently revealed. The generic `FoldView` binds to
 * this and needs nothing else — each slot names its own view token and its own
 * child VM, so adding a slot is a VM + registration change and never a view one.
 */
export interface IFoldViewModel extends ViewModel {
  /** The slot collection to show. Invariant: 1 ≤ length ≤ 3 (see assertFoldSlots). */
  readonly slots: readonly FoldSlot[];
  /** How many slots are revealed. Starts at 1; the view renders slots[0, revealedCount). */
  readonly revealedCount: ReactiveProperty<number>;
  /**
   * How far into {@link slots} the VM will currently let the viewer expand — the
   * reveal CEILING. Invariants: `1 ≤ revealableCount ≤ slots.length`, and
   * `revealedCount ≤ revealableCount`.
   *
   * This is the VM's **rule**, not the view's bound, and it is deliberately a
   * different question from `slots.length`:
   *
   *   - `slots` is STRUCTURE — which panels this fold is composed of, and in
   *     what order. It is static for the life of the VM.
   *   - `revealableCount` is POLICY — how far into that structure there is
   *     anything worth showing *right now*. It moves with the data.
   *
   * The two coincide for a fold whose every declared slot always has content,
   * and that coincidence is a trap: a view that clamps on `slots.length` will
   * happily reveal a panel the VM has already decided is empty. Only the VM
   * knows why a slot has nothing to say, so only the VM may answer this — the
   * view reads the number and never re-derives it.
   *
   * Reactive because the answer changes under the viewer: a slot with nothing to
   * report when the fold opened can acquire something to report a moment later.
   * Widening the ceiling makes {@link expandNext} live again but must NOT reveal
   * a slot on the viewer's behalf — an unrequested entrance reads to the viewer as
   * the app having reloaded itself. Narrowing it DOES clamp
   * `revealedCount` down, since a revealed slot with no content is the very
   * thing the ceiling exists to prevent.
   */
  readonly revealableCount: ReactiveProperty<number>;
  /** Reveal the next slot; no-op once {@link revealableCount} slots are revealed. */
  readonly expandNext: Command;
  /**
   * Hide the last revealed slot; no-op once only the first slot remains (the
   * fold always shows at least one).
   *
   * The mirror of {@link expandNext}. Reveal is a two-way control, not a
   * ratchet: the affordance that widens the drawer must be able to narrow it
   * again, and a view cannot do that by writing `revealedCount` directly —
   * `revealedCount` is a read-only surface for the view, and clamping to
   * `[1, revealableCount]` is the VM's job.
   */
  readonly collapsePrevious: Command;
}

/**
 * Enforce the fold slot invariant in exactly one place: a collection has at
 * least one and at most three slots, with unique keys. Call from a fold VM's
 * constructor. Throws rather than clamping — an out-of-range collection is a
 * programming error, not a runtime condition to absorb.
 *
 * The ceiling of three is a deliberate constraint of this contract, not an
 * accident: a fold is a progressive-disclosure control, and a collection needing
 * more panels than that wants to be navigation instead.
 */
export function assertFoldSlots(slots: readonly FoldSlot[]): void {
  if (slots.length < 1 || slots.length > 3) {
    throw new RangeError(`Fold requires 1–3 slots, got ${slots.length}`);
  }
  const keys = new Set(slots.map((s) => s.key));
  if (keys.size !== slots.length) {
    throw new Error('Fold slots must have duplicate-free keys');
  }
}
