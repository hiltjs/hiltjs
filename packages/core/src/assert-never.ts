/**
 * Compile-time exhaustiveness guard for discriminated unions.
 *
 * Place it in the `default:` arm of a `switch` over a union's discriminant:
 * if a new arm is added to the union and the switch does not handle it, the
 * argument is no longer of type `never` and the call fails to compile. At
 * runtime — should a malformed value slip past the type system (e.g. an
 * unknown discriminant off a wire payload) — it throws rather than falling
 * through silently.
 *
 * @example
 * switch (event.event) {
 *   case 'A': return handleA(event);
 *   case 'B': return handleB(event);
 *   default:  return assertNever(event); // compile error if an arm is missing
 * }
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled discriminated-union arm: ${String(value)}`);
}
