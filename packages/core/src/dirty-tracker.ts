import type { Observable, Subscription } from 'rxjs';
import { BehaviorSubject } from 'rxjs';

import type { ViewModel } from './view-model';

/**
 * Tracks whether a {@link ViewModel} has been mutated since the last
 * `markClean()` call. Subscribes to the VM's `propertyChanged$` and
 * flips `isDirty$` to `true` on the first change after a clean state.
 *
 * Typical use: pair with {@link ViewModel.canDeactivate} to gate
 * navigation/close on unsaved changes.
 *
 * ```ts
 * class EditUserVM extends ViewModelBase {
 *   readonly form = this.property('form', initialForm);
 *   readonly dirty = this.dirtyTracker();
 *
 *   readonly save = new AsyncCommand(async () => {
 *     await this.api.save(this.form.value);
 *     this.dirty.markClean();
 *   });
 *
 *   override async canDeactivate(): Promise<boolean> {
 *     if (!this.dirty.isDirty) return true;
 *     return await this.confirmDiscard();
 *   }
 * }
 * ```
 *
 * Implementation note: this is a *flag-based* tracker. Any tracked
 * property change marks dirty; the user calls `markClean()` after a
 * successful save. We don't snapshot values because most VMs don't
 * need true value equality — "did anything change since the last
 * commit?" is enough to gate navigation.
 */
export class DirtyTracker {
  private readonly _isDirty$: BehaviorSubject<boolean>;
  private readonly subscription: Subscription;

  readonly isDirty$: Observable<boolean>;

  constructor(vm: ViewModel, initialDirty = false) {
    this._isDirty$ = new BehaviorSubject<boolean>(initialDirty);
    this.isDirty$ = this._isDirty$.asObservable();
    this.subscription = vm.propertyChanged$.subscribe(() => {
      if (!this._isDirty$.value) {
        this._isDirty$.next(true);
      }
    });
  }

  get isDirty(): boolean {
    return this._isDirty$.value;
  }

  /** Reset to a clean state. Call after a successful save / commit. */
  markClean(): void {
    if (this._isDirty$.value) {
      this._isDirty$.next(false);
    }
  }

  /**
   * Force-mark dirty. Useful when changes happen outside the VM's
   * tracked properties (a child VM mutating, a side-effect on disk).
   */
  markDirty(): void {
    if (!this._isDirty$.value) {
      this._isDirty$.next(true);
    }
  }

  dispose(): void {
    if (this._isDirty$.closed) return;
    this.subscription.unsubscribe();
    this._isDirty$.complete();
  }
}
