import { describe, expect, it, vi } from 'vitest';

import { ReactiveProperty } from './reactive-property';
import type { DeactivationKind } from './view-model';
import { ViewModelBase } from './view-model-base';

class HookSpyVM extends ViewModelBase {
  onActivateCalls = 0;
  onDeactivateCalls: DeactivationKind[] = [];

  protected override async onActivate(): Promise<void> {
    this.onActivateCalls++;
  }

  protected override async onDeactivate(kind: DeactivationKind): Promise<void> {
    this.onDeactivateCalls.push(kind);
  }
}

describe('ViewModelBase: lifecycle', () => {
  it('activate() is idempotent', async () => {
    const vm = new HookSpyVM();
    await vm.activate();
    await vm.activate();
    expect(vm.onActivateCalls).toBe(1);
    expect(vm.isActive).toBe(true);
  });

  it("deactivate('temporary') leaves the VM disposable later", async () => {
    const vm = new HookSpyVM();
    await vm.activate();
    await vm.deactivate('temporary');
    expect(vm.onDeactivateCalls).toEqual(['temporary']);
    expect(vm.isActive).toBe(false);
    // Still alive: a fresh activate works
    await vm.activate();
    expect(vm.onActivateCalls).toBe(2);
  });

  it("deactivate('closing') runs dispose immediately after", async () => {
    const vm = new HookSpyVM();
    await vm.activate();
    await vm.deactivate('closing');
    expect(vm.onDeactivateCalls).toEqual(['closing']);
    // After closing, activate is a no-op (subjects are completed)
    await vm.activate();
    expect(vm.onActivateCalls).toBe(1);
  });

  it("deactivate('temporary') without prior activate is a no-op", async () => {
    const vm = new HookSpyVM();
    await vm.deactivate('temporary');
    expect(vm.onDeactivateCalls).toHaveLength(0);
  });

  it("deactivate('closing') without prior activate still notifies (terminal)", async () => {
    // Caliburn-style: closing is the terminal state. Subclasses may have
    // resources set up in the constructor that need release on close even
    // if onActivate never ran.
    const vm = new HookSpyVM();
    await vm.deactivate('closing');
    expect(vm.onDeactivateCalls).toEqual(['closing']);
  });

  it('isActive$ mirrors lifecycle', async () => {
    const vm = new HookSpyVM();
    const observed: boolean[] = [];
    vm.isActive$.subscribe((v) => observed.push(v));
    await vm.activate();
    await vm.deactivate('temporary');
    expect(observed).toEqual([false, true, false]);
  });

  it('canDeactivate defaults to true', async () => {
    const vm = new HookSpyVM();
    expect(await vm.canDeactivate()).toBe(true);
  });

  it('isBusy$ stays true for the entire duration of onActivate', async () => {
    let resolveOnActivate!: () => void;
    const onActivatePromise = new Promise<void>((r) => {
      resolveOnActivate = r;
    });
    class SlowVM extends ViewModelBase {
      protected override async onActivate(): Promise<void> {
        await onActivatePromise;
      }
    }
    const vm = new SlowVM();
    expect(vm.isBusy).toBe(false);
    const activatePromise = vm.activate();
    // Yield once so the synchronous part of activate() runs.
    await Promise.resolve();
    expect(vm.isBusy).toBe(true);
    resolveOnActivate();
    await activatePromise;
    expect(vm.isBusy).toBe(false);
  });

  it('isBusy$ flips back even when onActivate throws', async () => {
    class FailingVM extends ViewModelBase {
      protected override async onActivate(): Promise<void> {
        throw new Error('boom');
      }
    }
    const vm = new FailingVM();
    await expect(vm.activate()).rejects.toThrow('boom');
    expect(vm.isBusy).toBe(false);
  });
});

class PropsVM extends ViewModelBase {
  readonly name = this.property('name', 'alice');
  readonly age = this.property('age', 30);
  readonly internalCount = new ReactiveProperty(0); // NOT tracked

  setBoth(name: string, age: number): void {
    this.name.value = name;
    this.age.value = age;
  }
}

describe('ViewModelBase: propertyChanged$', () => {
  it('emits for tracked properties only, with name and value', () => {
    const vm = new PropsVM();
    const events: { name: string; value: unknown }[] = [];
    vm.propertyChanged$.subscribe((e) => events.push({ name: e.name, value: e.value }));
    vm.name.value = 'bob';
    vm.age.value = 31;
    vm.internalCount.value = 7; // not surfaced
    expect(events).toEqual([
      { name: 'name', value: 'bob' },
      { name: 'age', value: 31 },
    ]);
  });

  it('does not emit for the initial values on construction', () => {
    const vm = new PropsVM();
    const handler = vi.fn();
    vm.propertyChanged$.subscribe(handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not emit when distinct gate skips a no-change write', () => {
    const vm = new PropsVM();
    const handler = vi.fn();
    vm.propertyChanged$.subscribe(handler);
    vm.name.value = 'alice'; // same as initial → distinct skip
    expect(handler).not.toHaveBeenCalled();
  });

  it('completes propertyChanged$ on dispose', async () => {
    const vm = new PropsVM();
    const handler = vi.fn();
    let completed = false;
    vm.propertyChanged$.subscribe({
      next: handler,
      complete: () => {
        completed = true;
      },
    });
    await vm.activate();
    await vm.deactivate('closing');
    expect(completed).toBe(true);
  });
});

describe('ViewModelBase: dispose cleans up tracked properties', () => {
  it('completes tracked ReactiveProperty subjects', async () => {
    const vm = new PropsVM();
    let nameCompleted = false;
    vm.name.changes$.subscribe({
      complete: () => {
        nameCompleted = true;
      },
    });
    vm.dispose();
    expect(nameCompleted).toBe(true);
  });

  it('post-dispose writes to tracked properties are silent no-ops', () => {
    const vm = new PropsVM();
    vm.dispose();
    vm.name.value = 'bob';
    expect(vm.name.value).toBe('alice');
  });

  it('does not auto-complete bare ReactiveProperty (escape hatch)', () => {
    const vm = new PropsVM();
    let internalCompleted = false;
    vm.internalCount.changes$.subscribe({
      complete: () => {
        internalCompleted = true;
      },
    });
    vm.dispose();
    expect(internalCompleted).toBe(false);
  });
});

describe('ViewModelBase: dirtyTracker factory', () => {
  it('wires cleanup so tracker.dispose runs on VM dispose', () => {
    class TrackerVM extends ViewModelBase {
      readonly name = this.property('name', 'a');
      readonly tracker = this.dirtyTracker();
    }
    const vm = new TrackerVM();
    expect(vm.tracker.isDirty).toBe(false);

    vm.dispose();

    // After VM dispose, the tracker is also disposed: its isDirty$ is completed.
    let trackerCompleted = false;
    vm.tracker.isDirty$.subscribe({
      complete: () => {
        trackerCompleted = true;
      },
    });
    expect(trackerCompleted).toBe(true);
  });
});
