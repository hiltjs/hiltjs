import type { Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';

import type { DeactivationKind, ViewModel } from './view-model';
import { ViewModelBase } from './view-model-base';

/**
 * A ViewModel that owns child ViewModels and propagates lifecycle to
 * them. Comes in two flavors with different activation semantics:
 *
 *   - {@link ConductorOneActive}  — one active child at a time
 *     (tabs, wizards, single-pane sub-navigation)
 *   - {@link ConductorAllActive}  — all children active in parallel
 *     (composite screens — workspace with MessageList + Composer +
 *     TypingIndicator running together)
 *
 * `closeItem` removes the child for good (calls `deactivate('closing')`
 * which in turn calls `dispose` on the child). For temporary swaps —
 * suspend a wizard step, switch tabs — use `activateItem` directly.
 */
export interface Conductor<T extends ViewModel> extends ViewModel {
  readonly items$: Observable<readonly T[]>;
  readonly items: readonly T[];

  /** Permanently remove `item`. The child's lifecycle gets the `closing` kind. */
  closeItem(item: T): Promise<void>;
}

abstract class ConductorBase<T extends ViewModel> extends ViewModelBase implements Conductor<T> {
  protected readonly _items$ = new BehaviorSubject<readonly T[]>([]);

  readonly items$: Observable<readonly T[]> = this._items$.asObservable();

  get items(): readonly T[] {
    return this._items$.value;
  }

  abstract closeItem(item: T): Promise<void>;

  protected addItemToList(item: T): void {
    if (this._items$.value.includes(item)) return;
    this._items$.next([...this._items$.value, item]);
  }

  protected removeItemFromList(item: T): void {
    if (!this._items$.value.includes(item)) return;
    this._items$.next(this._items$.value.filter((i) => i !== item));
  }

  override dispose(): void {
    if (!this._items$.closed) this._items$.complete();
    super.dispose();
  }
}

/**
 * One active child at a time.
 *
 * Activating a different item suspends the current one with
 * `deactivate('temporary')` — its state is preserved so the user can
 * come back. Use {@link closeItem} to permanently dismiss.
 */
export class ConductorOneActive<T extends ViewModel> extends ConductorBase<T> {
  private readonly _activeItem$ = new BehaviorSubject<T | null>(null);

  readonly activeItem$: Observable<T | null> = this._activeItem$.asObservable();

  get activeItem(): T | null {
    return this._activeItem$.value;
  }

  /**
   * Make `item` the active child. Registers it if new. If a different
   * child was active, asks it `canDeactivate()` first; on veto the
   * switch is cancelled and the current child stays active.
   */
  async activateItem(item: T): Promise<void> {
    this.addItemToList(item);

    const current = this._activeItem$.value;
    if (current === item) {
      // Item is already active conceptually; ensure it's truly activated
      // (e.g., conductor was just activated for the first time).
      if (this.isActive) await item.activate();
      return;
    }

    if (current !== null) {
      const canSwitch = await current.canDeactivate();
      if (!canSwitch) return;
      await current.deactivate('temporary');
    }

    this._activeItem$.next(item);
    if (this.isActive) {
      await item.activate();
    }
  }

  /**
   * Permanently dismiss a child. Honors `canDeactivate()` — a child with
   * unsaved changes can refuse to close. If it was the active child, the
   * conductor falls back to the most recently added remaining item.
   */
  override async closeItem(item: T): Promise<void> {
    if (!this._items$.value.includes(item)) return;

    const canClose = await item.canDeactivate();
    if (!canClose) return;

    const wasActive = this._activeItem$.value === item;
    await item.deactivate('closing');
    this.removeItemFromList(item);

    if (wasActive) {
      // Pick the most recently added remaining item, or null if empty.
      const remaining = this._items$.value;
      const next = remaining.length > 0 ? remaining[remaining.length - 1] : null;
      this._activeItem$.next(next ?? null);
      if (next && this.isActive) {
        await next.activate();
      }
    }
  }

  protected override async onActivate(): Promise<void> {
    const current = this._activeItem$.value;
    if (current !== null) await current.activate();
  }

  protected override async onDeactivate(kind: DeactivationKind): Promise<void> {
    if (kind === 'closing') {
      // Tear down every child, not just the active one — the conductor
      // is going away for good.
      for (const item of [...this._items$.value]) {
        await item.deactivate('closing');
      }
      this._items$.next([]);
      this._activeItem$.next(null);
      return;
    }

    const current = this._activeItem$.value;
    if (current !== null) await current.deactivate('temporary');
  }

  override dispose(): void {
    if (!this._activeItem$.closed) this._activeItem$.complete();
    super.dispose();
  }
}

/**
 * All children active simultaneously.
 *
 * Adding an item activates it immediately if the conductor is active.
 * Suitable for composite screens where each sub-VM has independent
 * concerns but should run as a group.
 */
export class ConductorAllActive<T extends ViewModel> extends ConductorBase<T> {
  /**
   * Register an item and activate it (if the conductor is active).
   * No-op when the item is already registered.
   */
  async addItem(item: T): Promise<void> {
    const alreadyPresent = this._items$.value.includes(item);
    if (!alreadyPresent) {
      this.addItemToList(item);
    }
    if (this.isActive) await item.activate();
  }

  override async closeItem(item: T): Promise<void> {
    if (!this._items$.value.includes(item)) return;
    const canClose = await item.canDeactivate();
    if (!canClose) return;
    await item.deactivate('closing');
    this.removeItemFromList(item);
  }

  protected override async onActivate(): Promise<void> {
    for (const item of this._items$.value) {
      await item.activate();
    }
  }

  protected override async onDeactivate(kind: DeactivationKind): Promise<void> {
    for (const item of [...this._items$.value]) {
      await item.deactivate(kind);
    }
    if (kind === 'closing') {
      this._items$.next([]);
    }
  }
}
