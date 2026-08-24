/** Field validation as the **Specification pattern**: mirrors the backend's in-house `ISpec` / `SpecComposition` (the project chose Specification over a rule-engine / FluentValidation, so the frontend stays consistent). */

/** A validation failure as a code + optional i18n interpolation params. */
export interface ValidationFailure {
  /** Stable i18n key, e.g. `validation.email`. */
  readonly code: string;
  /** Primitives the i18n template interpolates, e.g. `{ min: 8 }`. */
  readonly params?: Readonly<Record<string, unknown>>;
}

/** A specification: a candidate satisfies it (`null`) or fails with a code. */
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

/** The trimmed value matches `re`, else fails with `code` (defaults to {@link ValidationCode.Pattern}). */
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

/** Negates a spec (mirrors `SpecComposition.Not`): satisfied when `spec` FAILS, fails with `code`/`params` when `spec` is satisfied. */
export const not = <T = string>(
  spec: Spec<T>,
  code: string,
  params?: Readonly<Record<string, unknown>>,
): Spec<T> => ({
  validate: (value) => (spec.validate(value) === null ? { code, params } : null),
});

/** Satisfied if ANY spec is satisfied (mirrors `SpecComposition.Or`); returns the last failure when all fail. */
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
