/**
 * Error model.
 *
 * Operations across the app return an {@link OperationResult} that either
 * carries a value or an {@link ErrorCollection}. The collection lets a
 * single operation surface multiple structured failures (think a form
 * that validates several fields at once) without forcing the caller to
 * choose one to bubble up.
 *
 * Severity ordering, lowest to highest:
 *   `warning` < `error` < `critical` < `fatal`
 *
 * - `warning`  — non-blocking; a degraded path is still usable
 * - `error`    — operation failed, user can retry
 * - `critical` — recoverable but serious (session expired, permission lost)
 * - `fatal`    — app cannot continue; force restart / fatal screen
 */

export type ErrorSeverity = 'warning' | 'error' | 'critical' | 'fatal';

export interface AppError {
  /** Stable machine code, e.g. `CONVERSATIONS.NOT_FOUND` or `NETWORK.OFFLINE`. */
  readonly code: string;
  /** Human-readable message — may be an i18n key the consumer resolves. */
  readonly message: string;
  readonly severity: ErrorSeverity;
  /**
   * Field path for validation errors, plain string. Nested paths follow
   * dot notation (`address.zipCode`); parsing is left to the consumer.
   */
  readonly field?: string;
  /** Raw exception captured for diagnostics; never exposed to the user. */
  readonly cause?: unknown;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Immutable collection of {@link AppError}. All mutations return a new
 * instance so observers downstream can compare references safely.
 */
export class ErrorCollection {
  private static readonly EMPTY = new ErrorCollection([]);

  private constructor(private readonly _errors: readonly AppError[]) {}

  static empty(): ErrorCollection {
    return ErrorCollection.EMPTY;
  }

  static of(...errors: AppError[]): ErrorCollection {
    return errors.length === 0 ? ErrorCollection.EMPTY : new ErrorCollection(errors);
  }

  /**
   * Wraps an arbitrary thrown value as a single-error collection.
   * Useful inside command handlers' catch blocks.
   */
  static fromException(cause: unknown, code = 'UNEXPECTED'): ErrorCollection {
    const message = cause instanceof Error ? cause.message : String(cause);
    return new ErrorCollection([
      {
        code,
        message,
        severity: 'error',
        cause,
      },
    ]);
  }

  get errors(): readonly AppError[] {
    return this._errors;
  }

  add(error: AppError): ErrorCollection {
    return new ErrorCollection([...this._errors, error]);
  }

  merge(other: ErrorCollection): ErrorCollection {
    if (other.isEmpty()) return this;
    if (this.isEmpty()) return other;
    return new ErrorCollection([...this._errors, ...other._errors]);
  }

  byField(field: string): readonly AppError[] {
    return this._errors.filter((e) => e.field === field);
  }

  bySeverity(severity: ErrorSeverity): readonly AppError[] {
    return this._errors.filter((e) => e.severity === severity);
  }

  /** True when the collection contains any error of any severity. */
  hasErrors(): boolean {
    return this._errors.length > 0;
  }

  /** True when at least one error is `critical` or `fatal`. */
  hasCritical(): boolean {
    return this._errors.some((e) => e.severity === 'critical' || e.severity === 'fatal');
  }

  isEmpty(): boolean {
    return this._errors.length === 0;
  }

  /**
   * Serializable shape for logging / IPC. `cause` is intentionally
   * excluded — it may hold a non-serializable Error / native handle.
   */
  toJSON(): readonly Omit<AppError, 'cause'>[] {
    return this._errors.map(({ code, message, severity, field, metadata }) => ({
      code,
      message,
      severity,
      ...(field !== undefined && { field }),
      ...(metadata !== undefined && { metadata }),
    }));
  }
}

/**
 * Discriminated-union result type used by every command and async
 * operation in the app. Narrow on `result.ok` to access either branch.
 */
export type OperationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: ErrorCollection };

export const Ok = <T>(value: T): OperationResult<T> => ({ ok: true, value });

export const Fail = <T = never>(errors: ErrorCollection): OperationResult<T> => ({
  ok: false,
  errors,
});
