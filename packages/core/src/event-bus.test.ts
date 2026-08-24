import { describe, expect, it, vi } from 'vitest';

import { eventToken, RxEventBus } from './event-bus';

interface ConvOpened {
  conversationId: string;
}
interface UserSignedIn {
  userId: string;
}

describe('RxEventBus', () => {
  it('publish → on round-trips with type-safe tokens', () => {
    const bus = new RxEventBus();
    const ConversationOpened = eventToken<ConvOpened>('ConversationOpened');
    const handler = vi.fn();
    bus.on(ConversationOpened).subscribe(handler);

    bus.publish(ConversationOpened, { conversationId: 'abc' });
    expect(handler).toHaveBeenCalledWith({ conversationId: 'abc' });
  });

  it('isolates subscribers by token name', () => {
    const bus = new RxEventBus();
    const A = eventToken<ConvOpened>('A');
    const B = eventToken<UserSignedIn>('B');
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    bus.on(A).subscribe(handlerA);
    bus.on(B).subscribe(handlerB);

    bus.publish(A, { conversationId: 'x' });
    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).not.toHaveBeenCalled();

    bus.publish(B, { userId: 'u' });
    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledTimes(1);
  });

  it('supports multiple subscribers for the same token', () => {
    const bus = new RxEventBus();
    const T = eventToken<ConvOpened>('Multi');
    const a = vi.fn();
    const b = vi.fn();
    bus.on(T).subscribe(a);
    bus.on(T).subscribe(b);
    bus.publish(T, { conversationId: 'q' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('does not deliver events published before subscription (Subject semantics)', () => {
    const bus = new RxEventBus();
    const T = eventToken<ConvOpened>('NoReplay');
    bus.publish(T, { conversationId: 'lost' });
    const handler = vi.fn();
    bus.on(T).subscribe(handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribe stops further deliveries', () => {
    const bus = new RxEventBus();
    const T = eventToken<ConvOpened>('Unsub');
    const handler = vi.fn();
    const sub = bus.on(T).subscribe(handler);
    bus.publish(T, { conversationId: 'a' });
    sub.unsubscribe();
    bus.publish(T, { conversationId: 'b' });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
