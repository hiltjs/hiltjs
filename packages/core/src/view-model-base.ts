import type { Observable } from 'rxjs';
import { BehaviorSubject, skip, Subject, Subscription } from 'rxjs';

import { DirtyTracker } from './dirty-tracker';
import { type AppError, ErrorCollection } from './errors';
import { ReactiveProperty, type ReactivePropertyOptions } from './reactive-property';
import type { DeactivationKind, PropertyChange, ViewModel } from './view-model';
import type {
  VmNotifiableError,
  VmNotification,
  VmNotificationKind,
} from './view-model-notification';

/** Optional metadata a caller may attach to a notification. */
interface NotifyOpts {
  readonly source?: string;
  readonly propertyName?: string;
}

/** Default {@link ViewModel} implementation. */
export abstract class ViewModelBase implements ViewModel {
  /** Sink for all RxJS subscriptions the VM creates. */
  protected readonly disposables = new Subscription();

  private readonly _isActive$ = new BehaviorSubject<boolean>(false);
  private readonly _isBusy$ = new BehaviorSubject<boolean>(false);
  private readonly _errors$ = new BehaviorSubject<ErrorCollection>(ErrorCollection.empty());
  private readonly _notifications$ = new Subject<VmNotification>();
  private readonly _propertyChanged$ = new Subject<PropertyChange>();
  /** Counter underlying `isBusy$` so nested/overlapping busy scopes (initial activation + a refresh fired before activation finishes, or two parallel commands) all keep the flag true until the last one resolves. */
  private _busyCount = 0;

  /** Holds every {@link ReactiveProperty} created through `this.property()` so `dispose()` can complete them: flushing a completion notification to external subscribers and turning post-dispose `value =` writes into silent no-ops. */
  private readonly _trackedProperties: ReactiveProperty<unknown>[] = [];

  /** Tracks disposal locally because `BehaviorSubject.next()` on a stopped subject silently updates the internal `_value` (the same quirk we worked around in {@link ReactiveProperty}). */
  private _disposed = false;

  readonly isActive$: Observable<boolean> = this._isActive$.asObservable();
  readonly isBusy$: Observable<boolean> = this._isBusy$.asObservable();
  readonly errors$: Observable<ErrorCollection> = this._errors$.asObservable();
  readonly notifications$: Observable<VmNotification> = this._notifications$.asObservable();
  readonly propertyChanged$: Observable<PropertyChange> = this._propertyChanged$.asObservable();

  /** Synchronous read of the active flag. */
  get isActive(): boolean {
    return !this._disposed && this._isActive$.value;
  }

  /** Synchronous read of the busy flag. */
  get isBusy(): boolean {
    return this._isBusy$.value;
  }

  async activate(): Promise<void> {
    if (this._disposed) return;
    if (this._isActive$.value) return;
    this._isActive$.next(true);
    await this.withBusy(() => this.onActivate());
  }

  async deactivate(kind: DeactivationKind): Promise<void> {
    if (this._disposed) return;

    if (kind === 'temporary') {
      if (!this._isActive$.value) return;
      await this.onDeactivate('temporary');
      this._isActive$.next(false);
      return;
    }

    await this.onDeactivate('closing');
    if (this._isActive$.value) this._isActive$.next(false);
    this.dispose();
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.disposables.unsubscribe();
    for (const prop of this._trackedProperties) {
      prop.complete();
    }
    this._trackedProperties.length = 0;
    this._isActive$.complete();
    this._isBusy$.complete();
    this._errors$.complete();
    this._notifications$.complete();
    this._propertyChanged$.complete();
  }

  /** Create a tracked {@link ReactiveProperty}. */
  protected property<T>(
    name: string,
    initial: T,
    options?: ReactivePropertyOptions<T>,
  ): ReactiveProperty<T> {
    const prop = new ReactiveProperty(initial, options);
    this._trackedProperties.push(prop as ReactiveProperty<unknown>);
    this.disposables.add(
      prop.changes$.pipe(skip(1)).subscribe((value: T) => {
        this._propertyChanged$.next({ name, value });
      }),
    );
    return prop;
  }

  /** Hook called once after the VM transitions to active. */
  protected onActivate(): void | Promise<void> {}

  /** Hook called when the VM is leaving the active state. */
  protected onDeactivate(_kind: DeactivationKind): void | Promise<void> {}

  /** Append a single error to the VM's error stream. */
  protected reportError(error: AppError): void {
    this._errors$.next(this._errors$.value.add(error));
  }

  /** Merge a collection of errors into the VM's error stream. */
  protected reportErrors(errors: ErrorCollection): void {
    if (errors.isEmpty()) return;
    this._errors$.next(this._errors$.value.merge(errors));
  }

  /** Reset the VM's error stream to an empty collection. */
  protected clearErrors(): void {
    if (this._errors$.value.isEmpty()) return;
    this._errors$.next(ErrorCollection.empty());
  }

  /** Publish a one-off notification on `notifications$`. */
  protected notify(notification: VmNotification): void {
    if (this._disposed) return;
    this._notifications$.next(notification);
  }

  protected notifyInfo(
    code: string,
    params?: Readonly<Record<string, unknown>>,
    opts: NotifyOpts = {},
  ): void {
    this.notify({ kind: 'info', code, params, ...opts });
  }
  protected notifySuccess(
    code: string,
    params?: Readonly<Record<string, unknown>>,
    opts: NotifyOpts = {},
  ): void {
    this.notify({ kind: 'success', code, params, ...opts });
  }
  protected notifyWarning(
    code: string,
    params?: Readonly<Record<string, unknown>>,
    opts: NotifyOpts = {},
  ): void {
    this.notify({ kind: 'warning', code, params, ...opts });
  }
  protected notifyError(
    code: string,
    params?: Readonly<Record<string, unknown>>,
    opts: NotifyOpts = {},
  ): void {
    this.notify({ kind: 'error', code, params, ...opts });
  }
  protected notifyValidation(
    code: string,
    params?: Readonly<Record<string, unknown>>,
    opts: NotifyOpts = {},
  ): void {
    this.notify({ kind: 'validation', code, params, ...opts });
  }

  /** Emit one error notification per `AppError` returned by a service call. */
  protected notifyFromErrors(errors: readonly VmNotifiableError[], opts: NotifyOpts = {}): void {
    this.notifyFromErrorsAs('error', errors, opts);
  }

  protected notifyFromErrorsAs(
    kind: VmNotificationKind,
    errors: readonly VmNotifiableError[],
    opts: NotifyOpts = {},
  ): void {
    for (const e of errors) {
      this.notify({
        kind,
        code: e.code,
        params: e.params,
        propertyName: e.propertyName ?? opts.propertyName,
        source: opts.source,
      });
    }
  }

  /** Available `kind` values: surfaced as a static for view code that needs a discriminated union of all of them at runtime (e.g. when filtering a stream). */
  protected static readonly NotificationKinds = [
    'info',
    'success',
    'warning',
    'error',
    'validation',
  ] as const satisfies readonly VmNotificationKind[];

  /** Wrap an async unit of work so `isBusy$` stays true until it settles. */
  protected async withBusy<T>(fn: () => T | Promise<T>): Promise<T> {
    this._busyCount += 1;
    if (this._busyCount === 1) this._isBusy$.next(true);
    try {
      return await fn();
    } finally {
      this._busyCount -= 1;
      if (this._busyCount === 0) this._isBusy$.next(false);
    }
  }

  /** Default veto: deactivation is always allowed. */
  canDeactivate(): boolean | Promise<boolean> {
    return true;
  }

  /** Create a {@link DirtyTracker} bound to this VM. */
  protected dirtyTracker(initialDirty = false): DirtyTracker {
    const tracker = new DirtyTracker(this, initialDirty);
    this.disposables.add(() => {
      tracker.dispose();
    });
    return tracker;
  }
}
