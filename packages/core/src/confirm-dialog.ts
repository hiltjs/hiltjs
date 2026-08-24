import { Subject, type Observable } from 'rxjs';

import type { DialogResult, IDialogService, IDialogViewModel } from './dialog-service';
import { ViewModelBase } from './view-model-base';

/** Coded copy for a confirmation dialog. */
export interface ConfirmCopy {
  readonly titleCode: string;
  readonly bodyCode: string;
  readonly confirmCode: string;
  readonly cancelCode: string;
  readonly tone?: 'default' | 'destructive';
}

/** A thin collaborator that asks the user to confirm a (usually destructive) action before it runs. */
export interface IActionConfirmer {
  confirm(copy: ConfirmCopy): Promise<boolean>;
}

/** Contract for the generic confirmation dialog VM: rendered by hilt's `DialogHost` (sheet on mobile, modal on desktop) via the ViewLocator. */
export interface IConfirmDialogViewModel extends IDialogViewModel<void> {
  readonly copy: ConfirmCopy;
  /** Confirm: emits `{ kind: 'confirmed', value: undefined }` once, then completes. */
  confirm(): void;
}

/** Generic confirmation dialog VM. */
export class ConfirmDialogVM extends ViewModelBase implements IConfirmDialogViewModel {
  /** i18n code the DialogHost renders as the (screen-reader) accessible title. */
  readonly titleCode: string;

  private readonly _result$ = new Subject<DialogResult<void>>();
  readonly result$: Observable<DialogResult<void>> = this._result$.asObservable();

  /** Guards the single-emission contract: a second confirm/cancel is a no-op. */
  private settled = false;

  constructor(readonly copy: ConfirmCopy) {
    super();
    this.titleCode = copy.titleCode;
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

/** Factory for the real action confirmer. */
export function createActionConfirmer(deps: { dialog: IDialogService }): IActionConfirmer {
  return {
    async confirm(copy: ConfirmCopy): Promise<boolean> {
      try {
        const result = await deps.dialog.show<void>(() => new ConfirmDialogVM(copy));
        return result.kind === 'confirmed';
      } catch {
        return false;
      }
    },
  };
}
