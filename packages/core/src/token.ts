/**
 * Brand-typed identifier for a service registered in the container.
 * The phantom `__t` field carries the runtime type at the type level so
 * `useInjected(tokens.api)` resolves to the right type without manual
 * generics at the call site.
 *
 * ```ts
 * const tokens = {
 *   bus: token<EventBus>('bus'),
 *   api: token<ConversationApi>('api'),
 *   inboxVM: token<InboxVM>('inboxVM'),
 * };
 *
 * container.register({
 *   [tokens.bus.name]: asClass(RxEventBus).singleton(),
 * });
 *
 * // In a component:
 * const bus = useInjected(tokens.bus); // typed as EventBus
 * ```
 *
 * Names are free-form strings; the brand keeps the matching honest at
 * the type level.
 */
export interface Token<T> {
  readonly name: string;
  /** Phantom — exists only at the type level for inference. */
  readonly __t?: T;
}

export const token = <T>(name: string): Token<T> => ({ name });
