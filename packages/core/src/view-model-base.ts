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

/**
 * Optional metadata a caller may attach to a notification. `source`
 * disambiguates per-screen aggregations; `propertyName` ties the
 * notification to a specific form field (typically used with
 * `validation` / `error` kinds).
 */
interface NotifyOpts {
  readonly source?: string;
  readonly propertyName?: string;
}

/**
 * Default {@link ViewModel} implementation. Subclasses override the
 * `onActivate` / `onDeactivate` hooks instead of the public methods so
 * the base class can keep the lifecycle invariants (idempotent activate,
 * dispose-on-close) consistent.
 *
 * State exposed:
 *   - `isActive$`  — `BehaviorSubject<boolean>` underneath
 *   - `errors$`    — `BehaviorSubject<ErrorCollection>` underneath
 *   - `disposables` — single `rxjs.Subscription` sink; add subscriptions
 *     here and they are torn down automatically on `dispose()`
 *
 * Thread/concurrency note: each VM is single-tenant from the view's
 * perspective. `activate()` and `deactivate()` are idempotent — calling
 * activate twice is a no-op, calling deactivate before activate is too.
 */
export abstract class ViewModelBase implements ViewModel {
  /**
   * Sink for all RxJS subscriptions the VM creates. Subclasses should
   * `disposables.add(stream$.subscribe(...))` rather than holding a
   * reference manually so cleanup happens in one place.
   */
  protected readonly disposables = new Subscription();

  private readonly _isActive$ = new BehaviorSubject<boolean>(false);
  private readonly _isBusy$ = new BehaviorSubject<boolean>(false);
  private readonly _errors$ = new BehaviorSubject<ErrorCollection>(ErrorCollection.empty());
  private readonly _notifications$ = new Subject<VmNotification>();
  private readonly _propertyChanged$ = new Subject<PropertyChange>();
  /**
   * Counter underlying `isBusy$` so nested/overlapping busy scopes
   * (initial activation + a refresh fired before activation finishes,
   * or two parallel commands) all keep the flag true until the last
   * one resolves. Without this, the inner scope's `false` would mask
   * the outer scope's still-true state.
   */
  private _busyCount = 0;

  /**
   * Holds every {@link ReactiveProperty} created through `this.property()`
   * so `dispose()` can complete them — flushing a completion notification
   * to external subscribers and turning post-dispose `value =` writes into
   * silent no-ops.
   */
  private readonly _trackedProperties: ReactiveProperty<unknown>[] = [];

  /**
   * Tracks disposal locally because `BehaviorSubject.next()` on a stopped
   * subject silently updates the internal `_value` (the same quirk we
   * worked around in {@link ReactiveProperty}). Without this flag, a
   * post-dispose `activate()` would slip past `_isActive$.value` checks
   * and run `onActivate` again on a torn-down VM.
   */
  private _disposed = false;

  readonly isActive$: Observable<boolean> = this._isActive$.asObservable();
  readonly isBusy$: Observable<boolean> = this._isBusy$.asObservable();
  readonly errors$: Observable<ErrorCollection> = this._errors$.asObservable();
  readonly notifications$: Observable<VmNotification> = this._notifications$.asObservable();
  readonly propertyChanged$: Observable<PropertyChange> = this._propertyChanged$.asObservable();

  /** Synchronous read of the active flag. Useful inside command handlers. */
  get isActive(): boolean {
    return !this._disposed && this._isActive$.value;
  }

  /**
   * Synchronous read of the busy flag. `true` while `activate()` is
   * running OR while any subclass has wrapped async work in
   * {@link withBusy}.
   */
  get isBusy(): boolean {
    return this._isBusy$.value;
  }

  async activate(): Promise<void> {
    if (this._disposed) return;
    if (this._isActive$.value) return;
    this._isActive$.next(true);
    // The whole activation cascade — including async fetches in
    // sub-VMs awaited inside `onActivate` — is "busy" from the view's
    // perspective. The view binds to `isBusy$` to gate any list/data
    // rendering, so the empty-while-loading flash that happens when
    // `items` starts at `[]` and only fills mid-cascade never reaches
    // the user.
    await this.withBusy(() => this.onActivate());
  }

  async deactivate(kind: DeactivationKind): Promise<void> {
    if (this._disposed) return;

    if (kind === 'temporary') {
      // Going inactive temporarily only makes sense from an active state;
      // it's a suspend, not a teardown.
      if (!this._isActive$.value) return;
      await this.onDeactivate('temporary');
      this._isActive$.next(false);
      return;
    }

    // 'closing' — terminal transition. Caliburn-style: even children that
    // were never activated (or are currently 'temporary') get a 'closing'
    // notification so subclasses can release anything set up in the
    // constructor. Always followed by dispose().
    await this.onDeactivate('closing');
    if (this._isActive$.value) this._isActive$.next(false);
    this.dispose();
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    // Order matters:
    //   1. Tear down every internal subscription (the property → propertyChanged$
    //      forwarders, plus anything subclasses added).
    //   2. Complete each tracked ReactiveProperty so external subscribers see
    //      the stream finish and post-dispose writes become silent no-ops.
    //   3. Complete the VM-level subjects last.
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

  /**
   * Create a tracked {@link ReactiveProperty}. Two effects vs. a bare
   * `new ReactiveProperty(...)`:
   *
   *   1. Mutations after construction surface on `propertyChanged$`
   *      tagged with `name` so generic observers (logging, devtools,
   *      persistence) see every change in one stream. The initial value
   *      is NOT emitted as a change.
   *   2. The property is registered with the VM so `dispose()` completes
   *      its underlying subject — external subscribers get the stream
   *      completion they expect and any accidental post-dispose writes
   *      become silent no-ops.
   *
   * Use this whenever the property should be visible to generic
   * observers OR when you want lifecycle-bound cleanup. For purely
   * private, ephemeral state, bare `new ReactiveProperty(...)` is fine.
   */
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

  /**
   * Hook called once after the VM transitions to active. Use it to wire
   * subscriptions, kick off initial fetches, etc. Add any subscription
   * to `this.disposables`.
   */
  protected onActivate(): void | Promise<void> {}

  /**
   * Hook called when the VM is leaving the active state. Receives the
   * kind so subclasses can branch on `temporary` (keep cached data) vs
   * `closing` (release everything — `dispose` runs immediately after).
   */
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

  /**
   * Publish a one-off notification on `notifications$`. Views and
   * the host (toaster, snackbar) subscribe to this stream and
   * dispatch by `kind`. The kernel does not buffer or replay; if no
   * one is listening, the event is gone.
   *
   * Use the `notifyInfo` / `notifyError` / etc. shortcuts in normal
   * code; this overload exists for cases that build the payload
   * dynamically (typed builder, structured logger, …).
   */
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

  /**
   * Emit one error notification per `AppError` returned by a service
   * call. Accepts the structural shape (`{ code; propertyName?;
   * params? }`) so callers can pass `Result.errors` directly without
   * importing the kernel's local notifiable-error type:
   *
   * ```ts
   * const result = await this.mutations.unmarkSpam(item);
   * if (!result.ok) this.notifyFromErrors(result.errors);
   * ```
   *
   * The `kind` is `'error'`; pass a different kind via
   * {@link notifyFromErrorsAs} when the caller wants `'validation'`
   * or similar (used by form VMs that surface server-side
   * validation as inline-field state, not toasts).
   */
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
        // The error's own propertyName takes precedence over the
        // call-site override — RFC 7807's `name` is the canonical
        // field association coming from the backend.
        propertyName: e.propertyName ?? opts.propertyName,
        source: opts.source,
      });
    }
  }

  /**
   * Available `kind` values — surfaced as a static for view code
   * that needs a discriminated union of all of them at runtime
   * (e.g. when filtering a stream).
   */
  protected static readonly NotificationKinds = [
    'info',
    'success',
    'warning',
    'error',
    'validation',
  ] as const satisfies readonly VmNotificationKind[];

  /**
   * Wrap an async unit of work so `isBusy$` stays true until it
   * settles. Counter-based, so nested calls (e.g. activate cascade
   * + a refresh fired during it) all resolve before the flag flips
   * back to false.
   */
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

  /**
   * Default veto: deactivation is always allowed. Override when the VM
   * owns state that could be lost — typically pair with a {@link DirtyTracker}.
   */
  canDeactivate(): boolean | Promise<boolean> {
    return true;
  }

  /**
   * Create a {@link DirtyTracker} bound to this VM. Subscribes to
   * `propertyChanged$` and registers cleanup with `disposables`, so the
   * tracker lives for as long as the VM does.
   */
  protected dirtyTracker(initialDirty = false): DirtyTracker {
    const tracker = new DirtyTracker(this, initialDirty);
    this.disposables.add(() => {
      tracker.dispose();
    });
    return tracker;
  }
}
