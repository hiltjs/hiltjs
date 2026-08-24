import { describe, expect, it, vi } from 'vitest';

import { ConductorAllActive, ConductorOneActive } from './conductor';
import type { DeactivationKind } from './view-model';
import { ViewModelBase } from './view-model-base';

class ChildVM extends ViewModelBase {
  activations = 0;
  deactivations: DeactivationKind[] = [];
  vetoNextDeactivate = false;

  protected override async onActivate(): Promise<void> {
    this.activations++;
  }

  protected override async onDeactivate(kind: DeactivationKind): Promise<void> {
    this.deactivations.push(kind);
  }

  override canDeactivate(): boolean {
    if (this.vetoNextDeactivate) {
      this.vetoNextDeactivate = false;
      return false;
    }
    return true;
  }
}

describe('ConductorOneActive', () => {
  it('activateItem registers and activates the child when conductor is active', async () => {
    const conductor = new ConductorOneActive<ChildVM>();
    await conductor.activate();

    const child = new ChildVM();
    await conductor.activateItem(child);

    expect(conductor.items).toContain(child);
    expect(conductor.activeItem).toBe(child);
    expect(child.activations).toBe(1);
  });

  it('does not activate children if the conductor itself is not active', async () => {
    const conductor = new ConductorOneActive<ChildVM>();
    const child = new ChildVM();
    await conductor.activateItem(child);

    expect(conductor.activeItem).toBe(child);
    expect(child.activations).toBe(0);

    // Activating the conductor activates the current item
    await conductor.activate();
    expect(child.activations).toBe(1);
  });

  it('switching items deactivates previous (temporary) and activates next', async () => {
    const conductor = new ConductorOneActive<ChildVM>();
    await conductor.activate();
    const a = new ChildVM();
    const b = new ChildVM();
    await conductor.activateItem(a);
    await conductor.activateItem(b);

    expect(a.deactivations).toEqual(['temporary']);
    expect(b.activations).toBe(1);
    expect(conductor.activeItem).toBe(b);
  });

  it('canDeactivate veto cancels the switch: current child stays active', async () => {
    const conductor = new ConductorOneActive<ChildVM>();
    await conductor.activate();
    const a = new ChildVM();
    const b = new ChildVM();
    await conductor.activateItem(a);

    a.vetoNextDeactivate = true;
    await conductor.activateItem(b);

    expect(a.deactivations).toEqual([]); // vetoed
    expect(b.activations).toBe(0);
    expect(conductor.activeItem).toBe(a);
  });

  it('closeItem disposes the child and falls back to most-recently-added remaining', async () => {
    const conductor = new ConductorOneActive<ChildVM>();
    await conductor.activate();
    const a = new ChildVM();
    const b = new ChildVM();
    const c = new ChildVM();
    await conductor.activateItem(a);
    await conductor.activateItem(b);
    await conductor.activateItem(c);

    expect(conductor.activeItem).toBe(c);
    await conductor.closeItem(c);
    expect(c.deactivations).toEqual(['closing']);
    expect(conductor.items).not.toContain(c);
    expect(conductor.activeItem).toBe(b);
    expect(b.activations).toBe(2); // re-activated as new active
  });

  it('closeItem honors canDeactivate veto', async () => {
    const conductor = new ConductorOneActive<ChildVM>();
    await conductor.activate();
    const a = new ChildVM();
    await conductor.activateItem(a);

    a.vetoNextDeactivate = true;
    await conductor.closeItem(a);

    expect(conductor.items).toContain(a);
    expect(a.deactivations).toEqual([]);
  });

  it("deactivate('closing') propagates closing to all children", async () => {
    const conductor = new ConductorOneActive<ChildVM>();
    await conductor.activate();
    const a = new ChildVM();
    const b = new ChildVM();
    await conductor.activateItem(a);
    await conductor.activateItem(b);

    await conductor.deactivate('closing');

    expect(a.deactivations).toEqual(['temporary', 'closing']);
    expect(b.deactivations).toEqual(['closing']);
    expect(conductor.items).toHaveLength(0);
    expect(conductor.activeItem).toBeNull();
  });

  it("deactivate('temporary') only suspends the active child", async () => {
    const conductor = new ConductorOneActive<ChildVM>();
    await conductor.activate();
    const a = new ChildVM();
    const b = new ChildVM();
    await conductor.activateItem(a);
    await conductor.activateItem(b); // a → temporary

    a.deactivations = []; // reset for clarity
    b.deactivations = [];

    await conductor.deactivate('temporary');

    // Only the active child is touched; non-active was already 'temporary'.
    expect(b.deactivations).toEqual(['temporary']);
    expect(a.deactivations).toEqual([]);
  });
});

describe('ConductorAllActive', () => {
  it('addItem activates immediately when conductor is active', async () => {
    const conductor = new ConductorAllActive<ChildVM>();
    await conductor.activate();

    const a = new ChildVM();
    const b = new ChildVM();
    await conductor.addItem(a);
    await conductor.addItem(b);

    expect(a.activations).toBe(1);
    expect(b.activations).toBe(1);
    expect(conductor.items).toEqual([a, b]);
  });

  it('addItem before conductor activate registers without activating', async () => {
    const conductor = new ConductorAllActive<ChildVM>();
    const a = new ChildVM();
    await conductor.addItem(a);
    expect(a.activations).toBe(0);

    await conductor.activate();
    expect(a.activations).toBe(1);
  });

  it('closeItem honors canDeactivate veto', async () => {
    const conductor = new ConductorAllActive<ChildVM>();
    await conductor.activate();
    const a = new ChildVM();
    await conductor.addItem(a);

    a.vetoNextDeactivate = true;
    await conductor.closeItem(a);

    expect(conductor.items).toContain(a);
    expect(a.deactivations).toEqual([]);
  });

  it('closeItem disposes the child when allowed', async () => {
    const conductor = new ConductorAllActive<ChildVM>();
    await conductor.activate();
    const a = new ChildVM();
    await conductor.addItem(a);

    await conductor.closeItem(a);

    expect(a.deactivations).toEqual(['closing']);
    expect(conductor.items).not.toContain(a);
  });

  it("deactivate('closing') propagates to every child", async () => {
    const conductor = new ConductorAllActive<ChildVM>();
    await conductor.activate();
    const a = new ChildVM();
    const b = new ChildVM();
    await conductor.addItem(a);
    await conductor.addItem(b);

    await conductor.deactivate('closing');

    expect(a.deactivations).toEqual(['closing']);
    expect(b.deactivations).toEqual(['closing']);
    expect(conductor.items).toHaveLength(0);
  });

  it("deactivate('temporary') propagates to every child", async () => {
    const conductor = new ConductorAllActive<ChildVM>();
    await conductor.activate();
    const a = new ChildVM();
    const b = new ChildVM();
    await conductor.addItem(a);
    await conductor.addItem(b);

    await conductor.deactivate('temporary');

    expect(a.deactivations).toEqual(['temporary']);
    expect(b.deactivations).toEqual(['temporary']);
    // Items list preserved on temporary deactivate
    expect(conductor.items).toEqual([a, b]);
  });
});

describe('Conductor: items$ stream', () => {
  it('emits the current items list on subscribe and after each change', async () => {
    const conductor = new ConductorAllActive<ChildVM>();
    const seenLengths: number[] = [];
    conductor.items$.subscribe((items) => seenLengths.push(items.length));

    await conductor.addItem(new ChildVM());
    await conductor.addItem(new ChildVM());

    expect(seenLengths).toEqual([0, 1, 2]);
  });
});

describe('Conductor: propertyChanged$ from VM base', () => {
  it("ignores child events: conductor's own propertyChanged$ stays clean", async () => {
    const conductor = new ConductorOneActive<ChildVM>();
    const handler = vi.fn();
    conductor.propertyChanged$.subscribe(handler);

    await conductor.activate();
    await conductor.activateItem(new ChildVM());
    await conductor.activateItem(new ChildVM());

    // Conductor doesn't expose its child membership via propertyChanged$
    // (items$ is a separate stream). No emissions expected here.
    expect(handler).not.toHaveBeenCalled();
  });
});
