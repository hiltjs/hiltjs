import type { Observable, Unsubscribable } from 'rxjs';
import { BehaviorSubject, combineLatest, map, of } from 'rxjs';

import { ErrorCollection, Fail, Ok, type OperationResult } from './errors';

/**
 * Reactive replacement for WPF's `ICommand`. Three observable signals
 * cover what a view typically needs to bind:
 *
 * - `canExecute$`   — should the trigger be enabled?
 * - `isExecuting$`  — is the command running right now? (loading state)
 * - `errors$`       — last execution's failures, if any
 *
 * `execute` returns an {@link OperationResult} so callers can react to
 * success/failure without subscribing to `errors$`.
 *
 * `dispose()` aborts any in-flight execution (async commands) and
 * completes the underlying subjects. The command also implements
 * `Unsubscribable` so it can be added directly to an RxJS `Subscription`
 * sink — typically `viewModelBase.disposables.add(myCommand)`.
 */
export interface Command<TParam = void, TResult = void> extends Unsubscribable {
  readonly canExecute$: Observable<boolean>;
  readonly isExecuting$: Observable<boolean>;
  readonly errors$: Observable<ErrorCollection>;

  execute(param: TParam): Promise<OperationResult<TResult>>;
  dispose(): void;
}

export interface CommandOptions {
  /**
   * External gate — typically derived from the owning ViewModel's state.
   * The effective `canExecute$` is `external && !isExecuting`.
   */
  readonly canExecute$?: Observable<boolean>;
}

const ALREADY_EXECUTING = ErrorCollection.of({
  code: 'COMMAND.ALREADY_EXECUTING',
  message: 'Command is already executing',
  severity: 'warning',
});

const ABORTED = (cause?: unknown): ErrorCollection =>
  ErrorCollection.of({
    code: 'COMMAND.ABORTED',
    message: 'Command execution was aborted',
    severity: 'warning',
    ...(cause !== undefined && { cause }),
  });

abstract class CommandBase<TParam, TResult> implements Command<TParam, TResult> {
  protected readonly _isExecuting$ = new BehaviorSubject<boolean>(false);
  protected readonly _errors$ = new BehaviorSubject<ErrorCollection>(ErrorCollection.empty());

  readonly canExecute$: Observable<boolean>;
  readonly isExecuting$: Observable<boolean> = this._isExecuting$.asObservable();
  readonly errors$: Observable<ErrorCollection> = this._errors$.asObservable();

  protected constructor(options: CommandOptions) {
    const externalCanExecute$ = options.canExecute$ ?? of(true);
    this.canExecute$ = combineLatest([externalCanExecute$, this._isExecuting$]).pipe(
      map(([can, executing]) => can && !executing),
    );
  }

  abstract execute(param: TParam): Promise<OperationResult<TResult>>;

  /** Alias for `dispose()` — lets the command slot into an RxJS sink. */
  unsubscribe(): void {
    this.dispose();
  }

  dispose(): void {
    if (this._isExecuting$.closed) return;
    this._isExecuting$.complete();
    this._errors$.complete();
  }

  protected guardConcurrent(): OperationResult<TResult> | null {
    return this._isExecuting$.value ? Fail<TResult>(ALREADY_EXECUTING) : null;
  }

  protected captureError(thrown: unknown): ErrorCollection {
    // Allow handlers to throw an ErrorCollection directly to propagate
    // structured validation failures without wrapping.
    return thrown instanceof ErrorCollection
      ? thrown
      : ErrorCollection.fromException(thrown, 'COMMAND.EXECUTION_FAILED');
  }
}

/**
 * Synchronous command. Fast operations that don't need loading state
 * (reset filters, navigate locally, toggle a flag). Throws still flow
 * through {@link OperationResult}.
 */
export class RelayCommand<TParam = void> extends CommandBase<TParam, void> {
  constructor(
    private readonly run: (param: TParam) => void,
    options: CommandOptions = {},
  ) {
    super(options);
  }

  async execute(param: TParam): Promise<OperationResult<void>> {
    const guard = this.guardConcurrent();
    if (guard) return guard;

    this._isExecuting$.next(true);
    this._errors$.next(ErrorCollection.empty());

    try {
      this.run(param);
      return Ok(undefined);
    } catch (e) {
      const errors = this.captureError(e);
      this._errors$.next(errors);
      return Fail(errors);
    } finally {
      this._isExecuting$.next(false);
    }
  }
}

/**
 * Context object passed as the second argument to an {@link AsyncCommand}'s
 * handler. The `signal` is wired to an internal `AbortController` so the
 * handler can forward it to `fetch`, `Request`, or any cancellation-aware
 * API. The signal is aborted when:
 *
 *   - `dispose()` is called (typically from the owning VM's disposal)
 *   - a new `execute()` arrives in 'switch' concurrency mode
 */
export interface AsyncCommandContext {
  readonly signal: AbortSignal;
}

export interface AsyncCommandOptions extends CommandOptions {
  /**
   * Behavior when `execute()` is called while a previous run is in flight:
   *
   *   - `'reject'` (default) — return a `COMMAND.ALREADY_EXECUTING` warning
   *     immediately and leave the in-flight run untouched.
   *   - `'switch'`           — abort the in-flight run via its `AbortSignal`
   *     and start a new one. Useful for autocomplete-style commands where
   *     only the latest input matters.
   */
  readonly concurrency?: 'reject' | 'switch';
}

/**
 * Asynchronous command. The handler returns a plain `Promise<TResult>`;
 * thrown values are converted to {@link ErrorCollection}. Handlers can
 * also throw an {@link ErrorCollection} directly to surface structured
 * validation failures with multiple fields.
 *
 * Handlers receive an {@link AsyncCommandContext} with an `AbortSignal`
 * — forward it to `fetch` etc. so cancellation cleans up real I/O when
 * the command is disposed or switched.
 */
export class AsyncCommand<TParam = void, TResult = void> extends CommandBase<TParam, TResult> {
  private readonly concurrency: 'reject' | 'switch';
  private currentController: AbortController | null = null;

  constructor(
    private readonly run: (param: TParam, ctx: AsyncCommandContext) => Promise<TResult>,
    options: AsyncCommandOptions = {},
  ) {
    super(options);
    this.concurrency = options.concurrency ?? 'reject';
  }

  async execute(param: TParam): Promise<OperationResult<TResult>> {
    if (this._isExecuting$.value) {
      if (this.concurrency === 'reject') {
        return Fail<TResult>(ALREADY_EXECUTING);
      }
      // 'switch' — abort the in-flight run; its `await` will throw, then
      // hit the catch block below and resolve as `COMMAND.ABORTED`.
      this.currentController?.abort();
    }

    const controller = new AbortController();
    this.currentController = controller;
    this._isExecuting$.next(true);
    this._errors$.next(ErrorCollection.empty());

    try {
      const value = await this.run(param, { signal: controller.signal });
      // The handler may not propagate the signal (or may swallow the abort
      // mid-await). Trust the signal as the authoritative source.
      if (controller.signal.aborted) {
        return Fail<TResult>(ABORTED());
      }
      return Ok(value);
    } catch (e) {
      if (this.isAbortError(e, controller.signal)) {
        return Fail<TResult>(ABORTED(e));
      }
      const errors = this.captureError(e);
      this._errors$.next(errors);
      return Fail(errors);
    } finally {
      // Only flip flags if we're still the current run — a 'switch' may
      // have already replaced us with a newer execution.
      if (this.currentController === controller) {
        this.currentController = null;
        if (!this._isExecuting$.closed) {
          this._isExecuting$.next(false);
        }
      }
    }
  }

  override dispose(): void {
    if (this._isExecuting$.closed) return;
    this.currentController?.abort();
    this.currentController = null;
    super.dispose();
  }

  private isAbortError(e: unknown, signal: AbortSignal): boolean {
    if (signal.aborted) return true;
    if (e instanceof Error && e.name === 'AbortError') return true;
    // DOMException wrapping aborted on some platforms
    if (
      typeof DOMException !== 'undefined' &&
      e instanceof DOMException &&
      e.name === 'AbortError'
    ) {
      return true;
    }
    return false;
  }
}
