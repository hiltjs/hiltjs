/**
 * Field validation as the **Specification pattern** — mirrors the backend's
 * in-house `ISpec` / `SpecComposition` (the project chose Specification over a
 * rule-engine / FluentValidation, so the frontend stays consistent).
 *
 * A {@link Spec} validates a value: it is either satisfied (`null`) or fails
 * with a stable **code** — never a user-facing string. Locale lives in the UI's
 * i18n bundle (the same hard rule as `VmNotification`). Specs compose with
 * {@link all}; a view-model holds one spec per field and runs it on every edit.
 *
 * This module is the generic **machinery** only — the `Spec` interface, the
 * composition (`all`), the `matches` combinator, and the code registry. The
 * concrete field specs (`required` / `email` / `minLength`) are NOT kernel
 * concerns — they belong to the consuming application: shared ones in its own
 * validation module, feature-specific ones alongside the feature's domain.
 */

/** A validation failure as a code + optional i18n interpolation params. */
export interface ValidationFailure {
  /** Stable i18n key, e.g. `validation.email`. The UI resolves it to copy. */
  readonly code: string;
  /** Primitives the i18n template interpolates, e.g. `{ min: 8 }`. */
  readonly params?: Readonly<Record<string, unknown>>;
}

/**
 * A specification: a candidate satisfies it (`null`) or fails with a code.
 *
 * Generic in the candidate type `T` (defaults to `string` for field validation,
 * the original use). A non-string `T` lets the SAME machinery compose predicates
 * over any subject — e.g. a conversation's capabilities compose `Spec<CapabilityContext>`.
 */
export interface Spec<T = string> {
  validate(value: T): ValidationFailure | null;
}

/** The validation codes the built-in specs can produce. */
export const ValidationCode = {
  Required: 'validation.required',
  Email: 'validation.email',
  MinLength: 'validation.minLength',
  /** Value does not match a required shape (e.g. a 6-digit verification code). */
  Pattern: 'validation.pattern',
} as const;

/**
 * The trimmed value matches `re`, else fails with `code` (defaults to
 * {@link ValidationCode.Pattern}). Reusable shape check — e.g. a 6-digit
 * verification code is `matches(/^\d{6}$/)`. `params` are passed through for
 * interpolation (e.g. `{ length: 6 }`).
 */
export const matches = (
  re: RegExp,
  code: string = ValidationCode.Pattern,
  params?: Readonly<Record<string, unknown>>,
): Spec => ({
  validate: (value) => (re.test(value.trim()) ? null : { code, params }),
});

/** Composes specs left-to-right; the first failure wins (mirrors `SpecComposition.And`). */
export const all = <T = string>(...specs: Spec<T>[]): Spec<T> => ({
  validate: (value) => {
    for (const spec of specs) {
      const failure = spec.validate(value);
      if (failure) return failure;
    }
    return null;
  },
});

/**
 * Negates a spec (mirrors `SpecComposition.Not`): satisfied when `spec` FAILS,
 * fails with `code`/`params` when `spec` is satisfied. `not` needs its own code
 * because the negated spec yields none on the path that now fails.
 */
export const not = <T = string>(
  spec: Spec<T>,
  code: string,
  params?: Readonly<Record<string, unknown>>,
): Spec<T> => ({
  validate: (value) => (spec.validate(value) === null ? { code, params } : null),
});

/**
 * Satisfied if ANY spec is satisfied (mirrors `SpecComposition.Or`); returns the
 * last failure when all fail. Zero specs → satisfied.
 */
export const any = <T = string>(...specs: Spec<T>[]): Spec<T> => ({
  validate: (value) => {
    let last: ValidationFailure | null = null;
    for (const spec of specs) {
      last = spec.validate(value);
      if (last === null) return null;
    }
    return last;
  },
});
