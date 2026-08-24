import { filter, firstValueFrom, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { DialogService, type DialogResult, type IDialogViewModel } from './dialog-service';
import { ViewModelBase } from './view-model-base';

class FakeDialogVM<TResult> extends ViewModelBase implements IDialogViewModel<TResult> {
  readonly resultSubject = new Subject<DialogResult<TResult>>();
  readonly result$ = this.resultSubject.asObservable();

  activations = 0;
  deactivations: ('temporary' | 'closing')[] = [];

  protected override async onActivate(): Promise<void> {
    this.activations++;
  }
  protected override async onDeactivate(kind: 'temporary' | 'closing'): Promise<void> {
    this.deactivations.push(kind);
  }

  cancel(): void {
    this.resultSubject.next({ kind: 'cancelled' });
  }
}

describe('DialogService', () => {
  it('starts with active$ === null', () => {
    const service = new DialogService();
    let observed: IDialogViewModel<unknown> | null | undefined;
    const sub = service.active$.subscribe((v) => {
      observed = v;
    });
    expect(observed).toBeNull();
    sub.unsubscribe();
  });

  it('show activates the VM and exposes it via active$', async () => {
    const service = new DialogService();
    const vm = new FakeDialogVM<string>();
    const activatedPromise = firstValueFrom(service.active$.pipe(filter((v) => v !== null)));

    const showPromise = service.show(() => vm);

    const active = await activatedPromise;
    expect(active).toBe(vm);
    expect(vm.activations).toBe(1);

    vm.resultSubject.next({ kind: 'confirmed', value: 'ok' });
    await showPromise;
  });

  it('show resolves with the confirmed result emitted on result$', async () => {
    const service = new DialogService();
    const vm = new FakeDialogVM<{ x: number }>();
    const showPromise = service.show(() => vm);

    await firstValueFrom(service.active$.pipe(filter((v) => v !== null)));
    vm.resultSubject.next({ kind: 'confirmed', value: { x: 42 } });

    const result = await showPromise;
    expect(result).toEqual({ kind: 'confirmed', value: { x: 42 } });
  });

  it('show resolves with cancelled when the VM emits cancelled', async () => {
    const service = new DialogService();
    const vm = new FakeDialogVM<string>();
    const showPromise = service.show(() => vm);

    await firstValueFrom(service.active$.pipe(filter((v) => v !== null)));
    vm.cancel();

    const result = await showPromise;
    expect(result).toEqual({ kind: 'cancelled' });
  });

  it('deactivates the VM with closing after result resolves', async () => {
    const service = new DialogService();
    const vm = new FakeDialogVM<string>();
    const showPromise = service.show(() => vm);

    await firstValueFrom(service.active$.pipe(filter((v) => v !== null)));
    vm.resultSubject.next({ kind: 'confirmed', value: 'x' });

    await showPromise;

    expect(vm.deactivations).toEqual(['closing']);
  });

  it('clears active$ before deactivate so the host stops rendering the VM first', async () => {
    const service = new DialogService();
    const vm = new FakeDialogVM<string>();

    let lastActive: IDialogViewModel<unknown> | null = null;
    let activeAtDeactivate: IDialogViewModel<unknown> | null | 'unset' = 'unset';
    service.active$.subscribe((v) => {
      lastActive = v;
    });

    const original = vm.deactivate.bind(vm);
    vi.spyOn(vm, 'deactivate').mockImplementation(async (kind) => {
      activeAtDeactivate = lastActive;
      return original(kind);
    });

    const showPromise = service.show(() => vm);
    await firstValueFrom(service.active$.pipe(filter((v) => v !== null)));
    vm.resultSubject.next({ kind: 'confirmed', value: 'x' });

    await showPromise;

    expect(activeAtDeactivate).toBeNull();
  });

  it('still deactivates the VM if the awaiter swallows the result via cancel', async () => {
    const service = new DialogService();
    const vm = new FakeDialogVM<string>();

    const showPromise = service.show(() => vm);
    await firstValueFrom(service.active$.pipe(filter((v) => v !== null)));
    vm.cancel();

    await showPromise;

    expect(vm.deactivations).toEqual(['closing']);
  });

  it('rejects a concurrent show() while another dialog is active', async () => {
    const service = new DialogService();
    const vmA = new FakeDialogVM<string>();
    const vmB = new FakeDialogVM<string>();

    const promiseA = service.show(() => vmA);
    await firstValueFrom(service.active$.pipe(filter((v) => v === vmA)));

    await expect(service.show(() => vmB)).rejects.toThrow(/another dialog is already active/);
    expect(vmB.activations).toBe(0);

    vmA.resultSubject.next({ kind: 'confirmed', value: 'A' });
    await promiseA;
  });

  it('serializes consecutive show calls (await one before the next)', async () => {
    const service = new DialogService();
    const vmA = new FakeDialogVM<string>();
    const vmB = new FakeDialogVM<string>();

    const promiseA = service.show(() => vmA);
    await firstValueFrom(service.active$.pipe(filter((v) => v === vmA)));
    vmA.resultSubject.next({ kind: 'confirmed', value: 'A' });
    await promiseA;

    const promiseB = service.show(() => vmB);
    await firstValueFrom(service.active$.pipe(filter((v) => v === vmB)));
    expect(vmB.activations).toBe(1);
    expect(vmA.deactivations).toEqual(['closing']);

    vmB.resultSubject.next({ kind: 'confirmed', value: 'B' });
    await promiseB;
  });
});
