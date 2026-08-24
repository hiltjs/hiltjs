import type { Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';

export interface ReactivePropertyOptions<T> {
  /**
   * Skip emitting when the next value is equal to the current one. Defaults
   * to `true`. Idempotent setters keep downstream subscribers (and React
   * re-renders) quiet when nothing actually changed.
   */
  readonly distinct?: boolean;
  /**
   * Custom equality used by the distinct gate. Defaults to `Object.is`,
   * which is the right answer for primitives and reference-stable objects.
   * Replace it for value-typed shapes (e.g. dates, immutable records).
   */
  readonly equals?: (a: T, b: T) => boolean;
}

/**
 * Reactive primitive for view-bindable state.
 *
 * Wraps a `BehaviorSubject<T>` with an ergonomic getter/setter so VMs
 * can declare bindable properties without the boilerplate of a private
 * subject + asObservable + custom setter for every field:
 *
 * ```ts
 * class CounterVM extends ViewModelBase {
 *   readonly count = new ReactiveProperty(0);
 *
 *   readonly increment = new RelayCommand(() => {
 *     this.count.value += 1;
 *   });
 * }
 * ```
 *
 * Reads are sync via `.value`. Writes via the setter or `.set(next)`.
 * Subscribers bind to `.changes$`, which is a BehaviorSubject-backed
 * stream — it emits the current value on subscribe and every change
 * thereafter (filtered by the distinct gate).
 *
 * Cleanup: call `.complete()` in `onDeactivate('closing')` if you need
 * subscribers to receive a stream completion. Otherwise GC handles it
 * when the VM is collected.
 */
export class ReactiveProperty<T> {
  private readonly _subject: BehaviorSubject<T>;
  private readonly _distinct: boolean;
  private readonly _equals: (a: T, b: T) => boolean;
  /**
   * Tracks completion locally because RxJS's `BehaviorSubject.next()`
   * mutates the internal `_value` even after `complete()` (the subject
   * stops emitting but its stored value is still overwritten). We need
   * post-complete writes to be a true no-op so reads observe the last
   * pre-completion value.
   */
  private _completed = false;

  /**
   * Stream of values. Emits the current value on subscribe and every
   * subsequent assignment (deduplicated by the distinct gate).
   */
  readonly changes$: Observable<T>;

  constructor(initial: T, options: ReactivePropertyOptions<T> = {}) {
    this._subject = new BehaviorSubject<T>(initial);
    this._distinct = options.distinct !== false;
    this._equals = options.equals ?? Object.is;
    this.changes$ = this._subject.asObservable();
  }

  /** Synchronous read of the current value. */
  get value(): T {
    return this._subject.value;
  }

  /**
   * Assign a new value. No-op when:
   *   - the property has been completed (post-dispose write)
   *   - the distinct gate is on (default) and the new value compares
   *     equal to the current one
   */
  set value(next: T) {
    if (this._completed) return;
    if (this._distinct && this._equals(this._subject.value, next)) return;
    this._subject.next(next);
  }

  /**
   * Method form of the setter. Useful when you want to pass it as a
   * callback (`tap(prop.set.bind(prop))`) without the syntactic friction
   * of an arrow that captures the property.
   */
  set(next: T): void {
    this.value = next;
  }

  /**
   * Apply a function to the current value and store the result.
   * Equivalent to `prop.value = updater(prop.value)` but reads better
   * for in-place updates of records or arrays.
   */
  update(updater: (current: T) => T): void {
    this.value = updater(this._subject.value);
  }

  /**
   * Complete the underlying subject. Call from `onDeactivate('closing')`
   * if subscribers rely on completion semantics. Idempotent. Subsequent
   * writes via `value =` / `set` / `update` become silent no-ops.
   */
  complete(): void {
    if (this._completed) return;
    this._completed = true;
    this._subject.complete();
  }
}
