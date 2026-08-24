import { BehaviorSubject, distinctUntilChanged, type Observable } from 'rxjs';

/** Discriminator for what's currently being presented as a full-page overlay (drawer / sheet) on top of the app shell. */
export type RouteOverlayKind = 'chat' | 'chat-test';

/** Cross-cutting service that flips full-page overlay surfaces on / off. */
export interface IRouteOverlayService {
  /** The currently presented overlay kind, or `null` when none is active. */
  readonly active$: Observable<RouteOverlayKind | null>;

  /** Flip the named overlay into the active slot. */
  open(kind: RouteOverlayKind): void;

  /** Dismiss the active overlay. */
  close(): void;
}

/** Default in-memory implementation. */
export class RouteOverlayService implements IRouteOverlayService {
  private readonly _active$ = new BehaviorSubject<RouteOverlayKind | null>(null);
  readonly active$: Observable<RouteOverlayKind | null> =
    this._active$.pipe(distinctUntilChanged());

  open(kind: RouteOverlayKind): void {
    this._active$.next(kind);
  }

  close(): void {
    if (this._active$.value === null) return;
    this._active$.next(null);
  }
}
