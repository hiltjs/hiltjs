import type { Observable } from 'rxjs';

import type { ErrorCollection } from './errors';
import type { VmNotification } from './view-model-notification';

/**
 * Distinguishes a transient deactivation (parent navigated away, screen
 * is in the background) from a permanent close (the VM will not be
 * reused — its `dispose()` is called at the end of `deactivate`).
 *
 *   `temporary` — keep state, may activate again
 *   `closing`   — release subscriptions, stop work, run `dispose`
 */
export type DeactivationKind = 'temporary' | 'closing';

/**
 * Notification emitted by `ViewModel.propertyChanged$` whenever a tracked
 * property changes. Equivalent to WPF's `INotifyPropertyChanged` event,
 * but typed and reactive instead of weak-string + delegate.
 *
 * Only properties registered via `ViewModelBase.property(name, initial)`
 * surface here. Bare `new ReactiveProperty(...)` instances stay private
 * to the VM unless the subclass forwards them manually.
 */
export interface PropertyChange<T = unknown> {
  /** Logical name passed to `property()`. Free-form; not validated. */
  readonly name: string;
  /** New value after the change. */
  readonly value: T;
}

/**
 * Caliburn.Micro-style lifecycle contract for a presentation model.
 *
 * View bindings:
 *   - call `activate()` when the view mounts (or becomes visible)
 *   - call `deactivate('temporary')` when the view goes off-screen but
 *     should resume later
 *   - call `deactivate('closing')` when the view is unmounted for good
 *
 * Reactive surface:
 *   - `isActive$`        mirrors lifecycle for views that bind on it
 *   - `isBusy$`          true while the VM is doing async work the view
 *                        should wait on — set automatically during
 *                        `activate()` (so views don't render half-loaded
 *                        cascades from sub-VMs) and available to
 *                        subclasses to wrap their own async commands.
 *   - `errors$`          failures the VM wants surfaced (commands that
 *                        fail can either keep their errors local or push
 *                        them up here)
 *   - `propertyChanged$` unified stream of every tracked property change.
 *                        Useful for logging, devtools, persistence,
 *                        dirty-tracking and telemetry.
 */
export interface ViewModel {
  readonly isActive$: Observable<boolean>;
  readonly isBusy$: Observable<boolean>;
  /** Synchronous read of the current busy flag. */
  readonly isBusy: boolean;
  readonly errors$: Observable<ErrorCollection>;
  /**
   * One-off events the view should surface (toast, snackbar, inline
   * banner). Discriminated by `kind` so the view dispatches without
   * pattern-matching on message text.
   */
  readonly notifications$: Observable<VmNotification>;
  readonly propertyChanged$: Observable<PropertyChange>;

  activate(): Promise<void>;
  deactivate(kind: DeactivationKind): Promise<void>;
  dispose(): void;

  /**
   * Veto for a pending deactivation. Return `false` (or a Promise that
   * resolves to `false`) to refuse — typically used for "you have
   * unsaved changes" guards. Conductors and screen-level navigation
   * code should call this before invoking `deactivate()`.
   *
   * Default implementation returns `true` (no veto). Override only when
   * the VM owns state that could be lost.
   */
  canDeactivate(): boolean | Promise<boolean>;
}
