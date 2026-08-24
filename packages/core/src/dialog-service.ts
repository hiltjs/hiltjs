import { BehaviorSubject, firstValueFrom, type Observable } from 'rxjs';

import type { ViewModel } from './view-model';

/**
 * VM presentable as a dialog. Layered on top of {@link ViewModel} —
 * the standard activate/deactivate lifecycle still applies and
 * `dispose` runs after the dialog closes.
 *
 * Adds a typed result stream that emits **exactly once** (confirmed
 * or cancelled) before the dialog tears down. The {@link IDialogService}
 * subscribes to `result$`'s first emission and uses it to resolve the
 * `show()` Promise the caller awaited.
 *
 * `cancel()` is the host-side dismiss path (overlay tap, swipe-down).
 * Implementations should emit `{ kind: 'cancelled' }` on `result$` so
 * the awaiting caller observes a uniform shape.
 */
export interface IDialogViewModel<TResult> extends ViewModel {
  readonly result$: Observable<DialogResult<TResult>>;
  cancel(): void;
  /**
   * Optional i18n CODE for the dialog's accessible title. The host renders it
   * as a (visually-hidden) title so screen readers announce the dialog by name
   * — codes-not-text, so the VM stays locale- and chrome-agnostic. Falls back
   * to a generic label when omitted.
   */
  readonly titleCode?: string;
  /**
   * Whether this dialog currently holds work the user would LOSE if it closed
   * (FE-578) — typed input, a chosen slot, a half-finished wizard.
   *
   * **The VM declares it, and the host reads it.** The alternative was a
   * `dismissOnOverlayPress` flag at each `show()` call site, which is how the
   * defect happened in the first place: `BottomSheet` has offered the option
   * since FE-540 and no call site ever passed it, so all eight dialogs
   * inherited "a tap anywhere on the backdrop discards this". Whether there is
   * something to lose is a fact about the dialog's own state, and only the VM
   * holds that state — a caller can at best guess it at the moment it opens the
   * dialog, which is precisely when the answer is still "no".
   *
   * A stream rather than a boolean because the answer CHANGES while the dialog
   * is open: an empty wizard is disposable and the same wizard three fields
   * later is not, and the host has to re-render on that transition. It is the
   * same shape {@link DirtyTracker.isDirty$} already publishes, so a VM that
   * uses one can forward it directly.
   *
   * Omitted means "nothing to lose", which is the honest default for the
   * confirms and pickers: they hold a decision, not data, and for them tapping
   * outside IS the cancel gesture — defaulting the other way would trap the
   * operator in a dialog whose only purpose is to be answered or dropped.
   */
  readonly isDirty$?: Observable<boolean>;
}

export type DialogResult<T> =
  | { readonly kind: 'confirmed'; readonly value: T }
  | { readonly kind: 'cancelled' };

/**
 * Cross-cutting service for presenting dialogs from any VM. NOT a
 * Conductor — dialogs are ad-hoc, not parent-child children. Any VM
 * can call `show()` to mint, present, and await the result of a
 * dialog VM without knowing how it's rendered.
 *
 * Single active dialog at a time. To open a second dialog after the
 * first, callers must `await` the first `show()` to settle. A
 * concurrent `show()` while another dialog is presented is rejected
 * with a thrown error — silently overwriting `active$` would orphan
 * the first VM (invisible but with a pending `result$` await), so
 * the failure is explicit instead.
 */
export interface IDialogService {
  /**
   * The dialog VM currently being presented, or `null` when no
   * dialog is active. The host (a platform-specific React component)
   * subscribes here and renders the appropriate view via a
   * ViewLocator.
   */
  readonly active$: Observable<IDialogViewModel<unknown> | null>;

  /**
   * Mint, activate, present, and await a dialog VM.
   *
   * `factory` runs synchronously and returns a fresh, fully-DI-wired
   * VM — typically `() => container.resolve(token)` followed by an
   * `initialize(input)` call for per-instance state. This pattern
   * keeps cross-cutting deps inside DI and lets the call-site pass
   * only what it owns from its context (e.g. customer name).
   *
   * Resolves with `{ kind: 'confirmed', value }` when the VM emits
   * confirmation on `result$`, or `{ kind: 'cancelled' }` when the
   * user dismisses (or `cancel()` is called programmatically).
   *
   * The VM is `deactivate('closing')`'d after the result resolves —
   * always, including on errors thrown by the awaiter or from the
   * factory itself.
   */
  show<TResult>(factory: () => IDialogViewModel<TResult>): Promise<DialogResult<TResult>>;
}

export class DialogService implements IDialogService {
  private readonly _active$ = new BehaviorSubject<IDialogViewModel<unknown> | null>(null);
  readonly active$: Observable<IDialogViewModel<unknown> | null> = this._active$.asObservable();

  async show<TResult>(factory: () => IDialogViewModel<TResult>): Promise<DialogResult<TResult>> {
    if (this._active$.value !== null) {
      throw new Error(
        'DialogService: another dialog is already active. Await the current show() before opening another.',
      );
    }
    const vm = factory();
    await vm.activate();
    // Cast widens TResult → unknown for storage on `active$`. The
    // TResult type is recovered through the awaited `result$`.
    this._active$.next(vm as IDialogViewModel<unknown>);
    try {
      return await firstValueFrom(vm.result$);
    } finally {
      this._active$.next(null);
      await vm.deactivate('closing');
    }
  }
}
