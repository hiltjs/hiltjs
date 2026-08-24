import type { Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';

import type { DeactivationKind, ViewModel } from './view-model';
import { ViewModelBase } from './view-model-base';

/** A ViewModel that owns child ViewModels and propagates lifecycle to them. */
export interface Conductor<T extends ViewModel> extends ViewModel {
  readonly items$: Observable<readonly T[]>;
  readonly items: readonly T[];

  /** Permanently remove `item`. */
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

/** One active child at a time. */
export class ConductorOneActive<T extends ViewModel> extends ConductorBase<T> {
  private readonly _activeItem$ = new BehaviorSubject<T | null>(null);

  readonly activeItem$: Observable<T | null> = this._activeItem$.asObservable();

  get activeItem(): T | null {
    return this._activeItem$.value;
  }

  /** Make `item` the active child. */
  async activateItem(item: T): Promise<void> {
    this.addItemToList(item);

    const current = this._activeItem$.value;
    if (current === item) {
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

  /** Permanently dismiss a child. */
  override async closeItem(item: T): Promise<void> {
    if (!this._items$.value.includes(item)) return;

    const canClose = await item.canDeactivate();
    if (!canClose) return;

    const wasActive = this._activeItem$.value === item;
    await item.deactivate('closing');
    this.removeItemFromList(item);

    if (wasActive) {
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

/** All children active simultaneously. */
export class ConductorAllActive<T extends ViewModel> extends ConductorBase<T> {
  /** Register an item and activate it (if the conductor is active). */
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
