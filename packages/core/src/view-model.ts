import type { Observable } from 'rxjs';

import type { ErrorCollection } from './errors';
import type { VmNotification } from './view-model-notification';

/** Distinguishes a transient deactivation (parent navigated away, screen is in the background) from a permanent close (the VM will not be reused: its `dispose()` is called at the end of `deactivate`). */
export type DeactivationKind = 'temporary' | 'closing';

/** Notification emitted by `ViewModel.propertyChanged$` whenever a tracked property changes. */
export interface PropertyChange<T = unknown> {
  /** Logical name passed to `property()`. */
  readonly name: string;
  /** New value after the change. */
  readonly value: T;
}

/** Caliburn.Micro-style lifecycle contract for a presentation model. */
export interface ViewModel {
  readonly isActive$: Observable<boolean>;
  readonly isBusy$: Observable<boolean>;
  /** Synchronous read of the current busy flag. */
  readonly isBusy: boolean;
  readonly errors$: Observable<ErrorCollection>;
  /** One-off events the view should surface (toast, snackbar, inline banner). */
  readonly notifications$: Observable<VmNotification>;
  readonly propertyChanged$: Observable<PropertyChange>;

  activate(): Promise<void>;
  deactivate(kind: DeactivationKind): Promise<void>;
  dispose(): void;

  /** Veto for a pending deactivation. */
  canDeactivate(): boolean | Promise<boolean>;
}
