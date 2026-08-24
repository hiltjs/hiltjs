import type { Observable } from 'rxjs';
import { filter, map, Subject } from 'rxjs';

/** Brand-typed token used to publish/subscribe to a specific event shape without runtime metadata. */
export interface EventToken<T> {
  readonly name: string;
  /** Phantom: exists only at the type level for inference. */
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

/** Single-subject implementation. */
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
