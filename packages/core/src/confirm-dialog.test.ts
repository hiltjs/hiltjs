/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogVM, createActionConfirmer } from './confirm-dialog';

const copy = {
  titleCode: 't',
  bodyCode: 'b',
  confirmCode: 'ok',
  cancelCode: 'no',
  tone: 'destructive',
} as const;

describe('ConfirmDialogVM', () => {
  it('exposes the coded copy and derives titleCode from it', () => {
    const vm = new ConfirmDialogVM(copy);
    expect(vm.copy).toBe(copy);
    expect(vm.titleCode).toBe('t');
  });

  it('confirm() emits { confirmed } exactly once on result$', async () => {
    const vm = new ConfirmDialogVM(copy);
    const result = firstValueFrom(vm.result$);
    vm.confirm();
    expect(await result).toEqual({ kind: 'confirmed', value: undefined });
  });

  it('cancel() emits { cancelled } on result$', async () => {
    const vm = new ConfirmDialogVM(copy);
    const result = firstValueFrom(vm.result$);
    vm.cancel();
    expect(await result).toEqual({ kind: 'cancelled' });
  });

  it('a second settle is a no-op (single-emission contract)', async () => {
    const vm = new ConfirmDialogVM(copy);
    const result = firstValueFrom(vm.result$);
    vm.confirm();
    vm.cancel(); // ignored — already settled
    expect(await result).toEqual({ kind: 'confirmed', value: undefined });
  });
});

describe('createActionConfirmer', () => {
  it('resolves true when the dialog is confirmed', async () => {
    const dialog = { show: vi.fn(async () => ({ kind: 'confirmed', value: undefined })) } as any;
    const confirmer = createActionConfirmer({ dialog });
    expect(await confirmer.confirm(copy)).toBe(true);
    expect(dialog.show).toHaveBeenCalledTimes(1);
  });

  it('resolves false when the dialog is cancelled / dismissed', async () => {
    const dialog = { show: vi.fn(async () => ({ kind: 'cancelled' })) } as any;
    const confirmer = createActionConfirmer({ dialog });
    expect(await confirmer.confirm(copy)).toBe(false);
  });

  it('fail-closes to false when the dialog cannot be presented (single-active-dialog guard)', async () => {
    const dialog = {
      show: vi.fn(async () => {
        throw new Error('DialogService: another dialog is already active.');
      }),
    } as any;
    const confirmer = createActionConfirmer({ dialog });
    // No throw bubbles out, and a destructive op reads this as "not confirmed".
    expect(await confirmer.confirm(copy)).toBe(false);
  });

  it('presents a fresh ConfirmDialogVM carrying the given copy', async () => {
    let presented: any;
    const dialog = {
      show: vi.fn(async (factory: () => any) => {
        presented = factory();
        return { kind: 'cancelled' };
      }),
    } as any;
    const confirmer = createActionConfirmer({ dialog });
    await confirmer.confirm(copy);
    expect(presented.copy).toBe(copy);
    expect(presented.titleCode).toBe('t');
  });
});
