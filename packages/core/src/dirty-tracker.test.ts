import { describe, expect, it } from 'vitest';

import { DirtyTracker } from './dirty-tracker';
import { ViewModelBase } from './view-model-base';

class TestVM extends ViewModelBase {
  readonly name = this.property('name', 'a');
  readonly age = this.property('age', 0);
}

describe('DirtyTracker', () => {
  it('starts clean by default', () => {
    const vm = new TestVM();
    const tracker = new DirtyTracker(vm);
    expect(tracker.isDirty).toBe(false);
  });

  it('starts dirty when constructed with initialDirty=true', () => {
    const vm = new TestVM();
    const tracker = new DirtyTracker(vm, true);
    expect(tracker.isDirty).toBe(true);
  });

  it('marks dirty on any tracked property change', () => {
    const vm = new TestVM();
    const tracker = new DirtyTracker(vm);
    expect(tracker.isDirty).toBe(false);
    vm.name.value = 'b';
    expect(tracker.isDirty).toBe(true);
  });

  it('markClean resets to clean even after changes', () => {
    const vm = new TestVM();
    const tracker = new DirtyTracker(vm);
    vm.name.value = 'b';
    expect(tracker.isDirty).toBe(true);
    tracker.markClean();
    expect(tracker.isDirty).toBe(false);
  });

  it('markDirty forces dirty', () => {
    const vm = new TestVM();
    const tracker = new DirtyTracker(vm);
    tracker.markDirty();
    expect(tracker.isDirty).toBe(true);
  });

  it('isDirty$ emits transitions', () => {
    const vm = new TestVM();
    const tracker = new DirtyTracker(vm);
    const observed: boolean[] = [];
    tracker.isDirty$.subscribe((v) => observed.push(v));
    vm.name.value = 'b';
    tracker.markClean();
    expect(observed).toEqual([false, true, false]);
  });

  it('does not re-emit if already in target state', () => {
    const vm = new TestVM();
    const tracker = new DirtyTracker(vm);
    const observed: boolean[] = [];
    tracker.isDirty$.subscribe((v) => observed.push(v));
    tracker.markClean(); // already clean → no emit
    vm.name.value = 'b'; // → dirty
    vm.age.value = 5; // already dirty → no emit
    expect(observed).toEqual([false, true]);
  });

  it('dispose stops tracking subsequent changes', () => {
    const vm = new TestVM();
    const tracker = new DirtyTracker(vm);
    tracker.dispose();
    vm.name.value = 'b'; // would normally mark dirty
    expect(tracker.isDirty).toBe(false);
  });

  it('dispose is idempotent', () => {
    const vm = new TestVM();
    const tracker = new DirtyTracker(vm);
    tracker.dispose();
    expect(() => {
      tracker.dispose();
    }).not.toThrow();
  });
});
