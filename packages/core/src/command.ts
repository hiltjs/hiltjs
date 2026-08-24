import type { Observable, Unsubscribable } from 'rxjs';
import { BehaviorSubject, combineLatest, map, of } from 'rxjs';

import { ErrorCollection, Fail, Ok, type OperationResult } from './errors';

/** Reactive replacement for WPF's `ICommand`. */
export interface Command<TParam = void, TResult = void> extends Unsubscribable {
  readonly canExecute$: Observable<boolean>;
  readonly isExecuting$: Observable<boolean>;
  readonly errors$: Observable<ErrorCollection>;

  execute(param: TParam): Promise<OperationResult<TResult>>;
  dispose(): void;
}

export interface CommandOptions {
  /** External gate: typically derived from the owning ViewModel's state. */
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

  /** Alias for `dispose()`: lets the command slot into an RxJS sink. */
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
    return thrown instanceof ErrorCollection
      ? thrown
      : ErrorCollection.fromException(thrown, 'COMMAND.EXECUTION_FAILED');
  }
}

/** Synchronous command. */
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

/** Context object passed as the second argument to an {@link AsyncCommand}'s handler. */
export interface AsyncCommandContext {
  readonly signal: AbortSignal;
}

export interface AsyncCommandOptions extends CommandOptions {
  /** Behavior when `execute()` is called while a previous run is in flight: - `'reject'` (default): return a `COMMAND.ALREADY_EXECUTING` warning immediately and leave the in-flight run untouched. */
  readonly concurrency?: 'reject' | 'switch';
}

/** Asynchronous command. */
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
      this.currentController?.abort();
    }

    const controller = new AbortController();
    this.currentController = controller;
    this._isExecuting$.next(true);
    this._errors$.next(ErrorCollection.empty());

    try {
      const value = await this.run(param, { signal: controller.signal });
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
