/** Brand-typed identifier for a service registered in the container. */
export interface Token<T> {
  readonly name: string;
  /** Phantom: exists only at the type level for inference. */
  readonly __t?: T;
}

export const token = <T>(name: string): Token<T> => ({ name });
