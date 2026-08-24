import type { Observable } from 'rxjs';
import { filter, map, Subject } from 'rxjs';

/**
 * Brand-typed token used to publish/subscribe to a specific event shape
 * without runtime metadata.
 *
 * The phantom `__t` field gives TypeScript what it needs to infer the
 * payload type at the call site:
 *
 * ```ts
 * const ConversationOpened = eventToken<{ conversationId: string }>('ConversationOpened');
 *
 * bus.publish(ConversationOpened, { conversationId: 'abc' });
 * bus.on(ConversationOpened).subscribe(e => console.log(e.conversationId));
 * ```
 */
export interface EventToken<T> {
  readonly name: string;
  /** Phantom — exists only at the type level for inference. */
  readonly __t?: T;
}

export const eventToken = <T>(name: string): EventToken<T> => ({ name });

interface Envelope {
  readonly token: string;
  readonly payload: unknown;
}

export interface EventBus {
  publish<T>(token: EventToken<T>, event: T): void;
  on<T>(token: EventToken<T>): Observable<T>;
}

/**
 * Single-subject implementation. All events flow through one stream and
 * subscribers filter by the token name. Trivial to instantiate per app
 * (singleton) or per scope (scoped bus for tests).
 */
export class RxEventBus implements EventBus {
  private readonly subject = new Subject<Envelope>();

  publish<T>(token: EventToken<T>, event: T): void {
    this.subject.next({ token: token.name, payload: event });
  }

  on<T>(token: EventToken<T>): Observable<T> {
    return this.subject.pipe(
      filter((env) => env.token === token.name),
      map((env) => env.payload as T),
    );
  }
}
