/**
 * Discriminator for one-off events a VM wants the view to surface.
 *
 * - `info`        — neutral status update; toaster default
 * - `success`     — completed action confirmation
 * - `warning`     — non-blocking warning the user should notice
 * - `error`       — operation failed (transient, recoverable)
 * - `validation`  — input rejected (typically inline, not a toast)
 *
 * Mapping kind → presentation is the view's call. The kernel just
 * routes the events.
 */
export type VmNotificationKind = 'info' | 'success' | 'warning' | 'error' | 'validation';

/**
 * Event payload published on `ViewModel.notifications$`. One emission
 * per discrete user-visible event — accumulating state belongs on
 * `errors$` (or a regular reactive property), not here.
 *
 * `code` is the only string the VM ever produces — a stable
 * identifier (e.g. `spam.unmark.success`, `DOMAIN.NOT_FOUND`,
 * `INFRASTRUCTURE.NETWORK`) the view translates via i18n at render
 * time. `params` carries primitives the i18n template interpolates
 * (`{{field}}`, `{{retryAfterSeconds}}`, etc); `propertyName` ties
 * `validation` / `error` notifications to a specific form field for
 * inline rendering.
 *
 * The VM never emits user-facing strings here. That's a hard rule —
 * locale lives in i18n bundles, not in mutation handlers.
 *
 * Views subscribe and dispatch by `kind` (e.g. `error` → red toast,
 * `info` → grey snackbar, `validation` → inline field error) and
 * call `t(\`notifications.${code}\`, params)` to render copy.
 */
export interface VmNotification {
  readonly kind: VmNotificationKind;
  readonly code: string;
  readonly propertyName?: string;
  readonly params?: Readonly<Record<string, unknown>>;
  /**
   * Optional source identifier. When a screen aggregates many
   * sub-VMs, `source` lets the host disambiguate "Inbox: failed to
   * load" vs "Customer: failed to load" without pattern-matching on
   * `code`.
   */
  readonly source?: string;
  /**
   * Optional single action affordance (e.g. an "Undo" button on a toast).
   * `labelCode` is an i18n key — same codes-not-text rule as `code` — the
   * view resolves via `t()`. `token` is an OPAQUE correlation id, never
   * shown to the user; it round-trips back through the notification sink
   * (`invokeAction(token)`) so the emitter can look up what to actually do.
   * No closures/callbacks live on this payload — that would leak a live
   * reference across the VM/service boundary and break serializability.
   */
  readonly action?: { readonly labelCode: string; readonly token: string };
}

/**
 * Structural shape of an error that can be emitted as a notification.
 * Declared structurally, not imported: the kernel accepts `Result.errors`
 * arrays from whichever layer produces them without depending on it.
 *
 * Anything implementing `{ code; propertyName?; params? }` slots in.
 */
export interface VmNotifiableError {
  readonly code: string;
  readonly propertyName?: string;
  readonly params?: Readonly<Record<string, unknown>>;
}
