import { Subject, type Observable } from 'rxjs';

import type { DialogResult, IDialogService, IDialogViewModel } from './dialog-service';
import { ViewModelBase } from './view-model-base';

/**
 * Coded copy for a confirmation dialog. **Codes, never text** — the view resolves
 * each to Spanish via `useT()`. `tone` lets a destructive, hard-to-reverse action
 * (e.g. send-to-spam, delete a document) paint its confirm affordance `hot`.
 */
export interface ConfirmCopy {
  readonly titleCode: string;
  readonly bodyCode: string;
  readonly confirmCode: string;
  readonly cancelCode: string;
  readonly tone?: 'default' | 'destructive';
}

/**
 * A thin collaborator that asks the user to confirm a (usually destructive)
 * action before it runs. It hides the dialog chrome behind a Promise so the
 * caller — a VM, an action runner — stays presentation-free.
 * Resolves `true` on confirm, `false` on cancel / dismiss.
 */
export interface IActionConfirmer {
  confirm(copy: ConfirmCopy): Promise<boolean>;
}

/**
 * Contract for the generic confirmation dialog VM — rendered by hilt's
 * `DialogHost` (sheet on mobile, modal on desktop) via the ViewLocator. Extends
 * {@link IDialogViewModel}`<void>` so `result$` (emits exactly once) and
 * `cancel()` are part of the contract. `confirm()` is the affirmative dismiss;
 * `cancel()` (host overlay-tap / swipe-down or programmatic) is the negative one.
 * The VM carries the {@link ConfirmCopy} the view binds.
 */
export interface IConfirmDialogViewModel extends IDialogViewModel<void> {
  readonly copy: ConfirmCopy;
  /** Confirm — emits `{ kind: 'confirmed', value: undefined }` once, then completes. */
  confirm(): void;
}

/**
 * Generic confirmation dialog VM. Neutral to presentation — hilt's `DialogHost`
 * renders it (sheet on mobile, modal on desktop) via the ViewLocator. It carries
 * only coded copy ({@link ConfirmCopy}); the view resolves the codes via `useT()`,
 * so the VM stays locale- and chrome-agnostic.
 *
 * Resolves the caller through `result$`: `confirmed` on {@link confirm}, `cancelled`
 * on {@link cancel} (host overlay-tap / swipe-down or programmatic). Emits exactly
 * once, then completes — the single-emission contract the `IDialogService` awaits.
 */
export class ConfirmDialogVM extends ViewModelBase implements IConfirmDialogViewModel {
  /** i18n code the DialogHost renders as the (screen-reader) accessible title. */
  readonly titleCode: string;

  private readonly _result$ = new Subject<DialogResult<void>>();
  readonly result$: Observable<DialogResult<void>> = this._result$.asObservable();

  /** Guards the single-emission contract — a second confirm/cancel is a no-op. */
  private settled = false;

  constructor(readonly copy: ConfirmCopy) {
    super();
    this.titleCode = copy.titleCode;
    // The result subject is a disposable resource: complete it on teardown.
    this.disposables.add(() => this._result$.complete());
  }

  confirm(): void {
    if (this.settled) return;
    this.settled = true;
    this._result$.next({ kind: 'confirmed', value: undefined });
    this._result$.complete();
  }

  cancel(): void {
    if (this.settled) return;
    this.settled = true;
    this._result$.next({ kind: 'cancelled' });
    this._result$.complete();
  }
}

/**
 * Factory for the real action confirmer. Presents a fresh {@link ConfirmDialogVM}
 * via `IDialogService.show()` and maps the `DialogResult<void>` to a plain boolean
 * for the caller — `confirmed` → `true`, `cancelled` → `false`.
 *
 * A fresh VM per call: its single-emission `result$` cannot be reused. Splitting
 * construction from DI wiring keeps the factory pure and unit-testable with a fake
 * dialog service — no container needed in tests.
 */
export function createActionConfirmer(deps: { dialog: IDialogService }): IActionConfirmer {
  return {
    async confirm(copy: ConfirmCopy): Promise<boolean> {
      try {
        const result = await deps.dialog.show<void>(() => new ConfirmDialogVM(copy));
        return result.kind === 'confirmed';
      } catch {
        // The only way `show()` rejects here is the DialogService "single active
        // dialog" guard (a ConfirmDialogVM can neither fail to construct nor to
        // activate) — i.e. another dialog is already open (e.g. a rapid double-tap,
        // or one fired while a picker is up). Treat it as NOT confirmed:
        // fail-closed for a destructive op, and — because callers read `false`
        // as a clean cancel — no spurious failure toast. The active dialog stays.
        return false;
      }
    },
  };
}
