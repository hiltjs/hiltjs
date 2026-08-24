import type { Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';

export interface ReactivePropertyOptions<T> {
  /** Skip emitting when the next value is equal to the current one. */
  readonly distinct?: boolean;
  /** Custom equality used by the distinct gate. */
  readonly equals?: (a: T, b: T) => boolean;
}

/** Reactive primitive for view-bindable state. */
export class ReactiveProperty<T> {
  private readonly _subject: BehaviorSubject<T>;
  private readonly _distinct: boolean;
  private readonly _equals: (a: T, b: T) => boolean;
  /** Tracks completion locally because RxJS's `BehaviorSubject.next()` mutates the internal `_value` even after `complete()` (the subject stops emitting but its stored value is still overwritten). */
  private _completed = false;

  /** Stream of values. */
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

  /** Assign a new value. */
  set value(next: T) {
    if (this._completed) return;
    if (this._distinct && this._equals(this._subject.value, next)) return;
    this._subject.next(next);
  }

  /** Method form of the setter. */
  set(next: T): void {
    this.value = next;
  }

  /** Apply a function to the current value and store the result. */
  update(updater: (current: T) => T): void {
    this.value = updater(this._subject.value);
  }

  /** Complete the underlying subject. */
  complete(): void {
    if (this._completed) return;
    this._completed = true;
    this._subject.complete();
  }
}
