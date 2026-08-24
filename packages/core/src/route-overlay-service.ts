import { BehaviorSubject, distinctUntilChanged, type Observable } from 'rxjs';

/**
 * Discriminator for what's currently being presented as a full-page
 * overlay (drawer / sheet) on top of the app shell. Each kind maps
 * 1:1 to a view component in the host's registry.
 *
 *   - `chat`      — production chat (inbox / kanban / etc.).
 *   - `chat-test` — sandbox test chat launched from the workflow
 *                   configurator. Same overlay infrastructure,
 *                   different VM composition (test mutations, no
 *                   header actions, reset button).
 *
 * Add new kinds (e.g. `kanban-detail`, `contact-card`) as their
 * flows ship.
 */
export type RouteOverlayKind = 'chat' | 'chat-test';

/**
 * Cross-cutting service that flips full-page overlay surfaces on /
 * off. Sibling to {@link IDialogService}; the two coexist:
 *
 *   - `IDialogService` is for **modal dialogs** with a typed result
 *     (`confirm` / `cancel`). Single-active by design.
 *   - `IRouteOverlayService` is for **page-like overlays** with no
 *     return value (chat, future kanban detail, etc.). The
 *     presentation occupies the whole screen on mobile and a
 *     side-pane / large modal on desktop. Single-active by design,
 *     but does NOT throw on a second `open` — the new overlay
 *     replaces the previous one (a fresh "navigation").
 *
 * Why a flag service (kind only) rather than a VM-bearing factory:
 *
 *   - The overlay's own VM tree is owned elsewhere (e.g. the chat
 *     VM is a singleton resolved through `chatTokens.chatVM`,
 *     activated by its conductor). The service is purely a render
 *     toggle — it does NOT manage the VM's activate / deactivate.
 *   - The host (one per app) maps `kind` → `ComponentType` via a
 *     small in-host registry. That keeps the service free of
 *     React types.
 *
 * Hardware / browser back is the host's responsibility (it has the
 * platform-specific listeners); the service just exposes
 * `close()`.
 */
export interface IRouteOverlayService {
  /**
   * The currently presented overlay kind, or `null` when none is
   * active. The host subscribes to this and renders the matching
   * view component inside its sheet / drawer container.
   */
  readonly active$: Observable<RouteOverlayKind | null>;

  /**
   * Flip the named overlay into the active slot. If another
   * overlay was already active, it is replaced (no error). The
   * caller is expected to have set up the underlying VM state
   * (e.g. `chatVM.open(conversationId)`) BEFORE invoking `open` —
   * the service does not orchestrate VM lifecycles.
   */
  open(kind: RouteOverlayKind): void;

  /** Dismiss the active overlay. No-op when none is active. */
  close(): void;
}

/**
 * Default in-memory implementation. Backed by a single
 * BehaviorSubject; the host treats `null` ↔ `kind` transitions as
 * mount / unmount.
 */
export class RouteOverlayService implements IRouteOverlayService {
  private readonly _active$ = new BehaviorSubject<RouteOverlayKind | null>(null);
  // `distinctUntilChanged` so consecutive `open('chat')` calls don't
  // re-fire the host's render path. Re-opening after a close still
  // emits because the kind transitions through `null` in between.
  readonly active$: Observable<RouteOverlayKind | null> =
    this._active$.pipe(distinctUntilChanged());

  open(kind: RouteOverlayKind): void {
    this._active$.next(kind);
  }

  close(): void {
    if (this._active$.value === null) return;
    this._active$.next(null);
  }
}
