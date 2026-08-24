import type { Observable, Subscription } from 'rxjs';
import { BehaviorSubject } from 'rxjs';

import type { ViewModel } from './view-model';

/** Tracks whether a {@link ViewModel} has been mutated since the last `markClean()` call. */
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

  /** Reset to a clean state. */
  markClean(): void {
    if (this._isDirty$.value) {
      this._isDirty$.next(false);
    }
  }

  /** Force-mark dirty. */
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
