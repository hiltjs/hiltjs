import { BehaviorSubject, firstValueFrom, type Observable } from 'rxjs';

import type { ViewModel } from './view-model';

/** VM presentable as a dialog. */
export interface IDialogViewModel<TResult> extends ViewModel {
  readonly result$: Observable<DialogResult<TResult>>;
  cancel(): void;
  /** Optional i18n CODE for the dialog's accessible title. */
  readonly titleCode?: string;
  /** Whether this dialog currently holds work the user would LOSE if it closed (FE-578): typed input, a chosen slot, a half-finished wizard. */
  readonly isDirty$?: Observable<boolean>;
}

export type DialogResult<T> =
  { readonly kind: 'confirmed'; readonly value: T } | { readonly kind: 'cancelled' };

/** Cross-cutting service for presenting dialogs from any VM. */
export interface IDialogService {
  /** The dialog VM currently being presented, or `null` when no dialog is active. */
  readonly active$: Observable<IDialogViewModel<unknown> | null>;

  /** Mint, activate, present, and await a dialog VM. */
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
    this._active$.next(vm);
    try {
      return await firstValueFrom(vm.result$);
    } finally {
      this._active$.next(null);
      await vm.deactivate('closing');
    }
  }
}
