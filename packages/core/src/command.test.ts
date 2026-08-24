import { BehaviorSubject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AsyncCommand, RelayCommand } from './command';
import { ErrorCollection } from './errors';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('RelayCommand', () => {
  it('runs the handler and returns Ok', async () => {
    const handler = vi.fn();
    const cmd = new RelayCommand<number>(handler);
    const result = await cmd.execute(7);
    expect(handler).toHaveBeenCalledWith(7);
    expect(result.ok).toBe(true);
  });

  it('isExecuting flips true during execution and false after', async () => {
    const observed: boolean[] = [];
    const cmd = new RelayCommand<void>(() => {
      // synchronous handler
    });
    cmd.isExecuting$.subscribe((v) => observed.push(v));
    await cmd.execute();
    expect(observed).toEqual([false, true, false]);
  });

  it('captures thrown ErrorCollection unmodified', async () => {
    const errors = ErrorCollection.of({
      code: 'V.REQUIRED',
      message: 'required',
      severity: 'error',
      field: 'name',
    });
    const cmd = new RelayCommand<void>(() => {
      throw errors;
    });
    const result = await cmd.execute();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toBe(errors);
  });

  it('wraps thrown Error into a single-error collection', async () => {
    const cmd = new RelayCommand<void>(() => {
      throw new Error('boom');
    });
    const result = await cmd.execute();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.errors[0]?.code).toBe('COMMAND.EXECUTION_FAILED');
      expect(result.errors.errors[0]?.message).toBe('boom');
    }
  });

  it('rejects concurrent execute() with COMMAND.ALREADY_EXECUTING', async () => {
    // Counts real invocations. The previous version of this test asserted on a
    // variable nothing ever assigned, so it passed whether or not the handler
    // ran; this one fails if it does.
    let handlerRuns = 0;
    const cmd = new RelayCommand<void>(() => {
      handlerRuns++;
    });
    // RelayCommand is sync, so the in-flight reject path is harder to hit
    // organically. Instead drive _isExecuting$ directly to simulate.
    const cmdAny = cmd as unknown as { _isExecuting$: BehaviorSubject<boolean> };
    cmdAny._isExecuting$.next(true);
    const result = await cmd.execute();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.errors[0]?.code).toBe('COMMAND.ALREADY_EXECUTING');
    cmdAny._isExecuting$.next(false);
    expect(handlerRuns).toBe(0); // handler never ran (gate flipped externally)
  });

  it('canExecute$ reflects external gate AND !isExecuting', async () => {
    const gate = new BehaviorSubject<boolean>(true);
    const cmd = new RelayCommand<void>(() => {}, { canExecute$: gate });
    const observed: boolean[] = [];
    cmd.canExecute$.subscribe((v) => observed.push(v));

    expect(observed.at(-1)).toBe(true);
    gate.next(false);
    expect(observed.at(-1)).toBe(false);
    gate.next(true);
    expect(observed.at(-1)).toBe(true);
  });

  it('dispose() completes subjects and is idempotent', () => {
    const cmd = new RelayCommand<void>(() => {});
    cmd.dispose();
    expect(() => {
      cmd.dispose();
    }).not.toThrow();
  });
});

describe('AsyncCommand', () => {
  it('returns Ok with the resolved value', async () => {
    const cmd = new AsyncCommand<number, number>(async (n) => n * 2);
    const result = await cmd.execute(5);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(10);
  });

  it('isExecuting$ flips true during the await and false after', async () => {
    let resolveHandler: (() => void) | undefined;
    const cmd = new AsyncCommand<void, void>(
      () =>
        new Promise<void>((resolve) => {
          resolveHandler = resolve;
        }),
    );
    const observed: boolean[] = [];
    cmd.isExecuting$.subscribe((v) => observed.push(v));

    const promise = cmd.execute();
    await flush();
    expect(observed.at(-1)).toBe(true);

    resolveHandler?.();
    await promise;
    expect(observed.at(-1)).toBe(false);
  });

  it('captures rejected promise as Error wrapped collection', async () => {
    const cmd = new AsyncCommand<void, void>(async () => {
      throw new Error('fetch failed');
    });
    const result = await cmd.execute();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.errors[0]?.code).toBe('COMMAND.EXECUTION_FAILED');
      expect(result.errors.errors[0]?.message).toBe('fetch failed');
    }
  });

  it('propagates a thrown ErrorCollection without re-wrapping', async () => {
    const errors = ErrorCollection.of({
      code: 'V.X',
      message: 'x',
      severity: 'error',
    });
    const cmd = new AsyncCommand<void, void>(async () => {
      throw errors;
    });
    const result = await cmd.execute();
    if (!result.ok) expect(result.errors).toBe(errors);
  });

  it('default concurrency rejects a second execute while in flight', async () => {
    let resolve: (() => void) | undefined;
    const cmd = new AsyncCommand<void, void>(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const p1 = cmd.execute();
    await flush();
    const p2 = await cmd.execute();
    expect(p2.ok).toBe(false);
    if (!p2.ok) expect(p2.errors.errors[0]?.code).toBe('COMMAND.ALREADY_EXECUTING');
    resolve?.();
    const r1 = await p1;
    expect(r1.ok).toBe(true);
  });

  it("'switch' concurrency aborts the in-flight run", async () => {
    const seen: string[] = [];
    const cmd = new AsyncCommand<string, string>(
      (label, { signal }) =>
        new Promise<string>((resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              seen.push(`abort:${label}`);
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
          // Long-running: only resolves on abort or timeout
          setTimeout(() => resolve(`ok:${label}`), 1000);
        }),
      { concurrency: 'switch' },
    );

    const p1 = cmd.execute('first');
    await flush();
    const p2Promise = cmd.execute('second');
    const r1 = await p1;
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.errors.errors[0]?.code).toBe('COMMAND.ABORTED');
    expect(seen).toContain('abort:first');

    // Clean up the second run
    cmd.dispose();
    await p2Promise;
  });

  it('forwards an AbortSignal to the handler', async () => {
    let received: AbortSignal | undefined;
    const cmd = new AsyncCommand<void, void>(async (_, ctx) => {
      received = ctx.signal;
    });
    await cmd.execute();
    expect(received).toBeInstanceOf(AbortSignal);
    expect(received?.aborted).toBe(false);
  });

  it('dispose() aborts the in-flight run and resolves it as ABORTED', async () => {
    const cmd = new AsyncCommand<void, void>(
      (_, { signal }) =>
        new Promise<void>((_, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );
    const promise = cmd.execute();
    await flush();
    cmd.dispose();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.errors[0]?.code).toBe('COMMAND.ABORTED');
  });

  it('treats a handler that ignores the signal but where signal is aborted as ABORTED', async () => {
    // Handler doesn't check the signal — it just resolves. The post-await check
    // on signal.aborted should still classify the run as aborted.
    const cmd = new AsyncCommand<void, string>(
      async () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('done'), 10);
        }),
      { concurrency: 'switch' },
    );
    const p1 = cmd.execute();
    void cmd.execute(); // triggers abort on p1
    const r1 = await p1;
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.errors.errors[0]?.code).toBe('COMMAND.ABORTED');
    cmd.dispose();
  });

  it('canExecute$ reflects external gate AND !isExecuting', async () => {
    const gate = new BehaviorSubject<boolean>(true);
    let resolve: (() => void) | undefined;
    const cmd = new AsyncCommand<void, void>(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
      { canExecute$: gate },
    );
    const observed: boolean[] = [];
    cmd.canExecute$.subscribe((v) => observed.push(v));

    expect(observed.at(-1)).toBe(true);
    const inFlight = cmd.execute();
    await flush();
    expect(observed.at(-1)).toBe(false); // executing
    resolve?.();
    await flush();
    expect(observed.at(-1)).toBe(true);
    gate.next(false);
    expect(observed.at(-1)).toBe(false);
    await inFlight;
  });
});
