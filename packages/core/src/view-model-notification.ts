/** Discriminator for one-off events a VM wants the view to surface. */
export type VmNotificationKind = 'info' | 'success' | 'warning' | 'error' | 'validation';

/** Event payload published on `ViewModel.notifications$`. */
export interface VmNotification {
  readonly kind: VmNotificationKind;
  readonly code: string;
  readonly propertyName?: string;
  readonly params?: Readonly<Record<string, unknown>>;
  /** Optional source identifier. */
  readonly source?: string;
  /** Optional single action affordance (e.g. an "Undo" button on a toast). */
  readonly action?: { readonly labelCode: string; readonly token: string };
}

/** Structural shape of an error that can be emitted as a notification. */
export interface VmNotifiableError {
  readonly code: string;
  readonly propertyName?: string;
  readonly params?: Readonly<Record<string, unknown>>;
}
