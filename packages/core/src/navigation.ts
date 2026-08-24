/**
 * A typed navigation destination. The `__p` phantom carries the parameter
 * type at the type level only (mirrors `Token<T>`'s `__t`), so
 * `navigateTo(signUpNav, { email })` is fully type-checked without the
 * view-model ever referencing a URL.
 */
export interface NavTarget<P> {
  readonly key: string;
  readonly __p?: P;
}

/** Declare a navigation destination. `key` is a stable id, e.g. `'auth.sign-up'`. */
export const navTarget = <P>(key: string): NavTarget<P> => ({ key });

/**
 * VM-first navigation. View-models navigate ONLY through this contract —
 * never through a router directly. The concrete implementation is platform-
 * specific and ships as an adapter (`ExpoNavigationService` in `@hiltjs/expo`);
 * it resolves the target to a URL via the route registry. Page navigation has no return value — flows that need
 * a result use `IDialogService`/`IRouteOverlayService` or the `EventBus`.
 */
export interface INavigationService {
  navigateTo<P>(target: NavTarget<P>, params: P): void;
  replace<P>(target: NavTarget<P>, params: P): void;
  back(): void;
  readonly canGoBack: boolean;
}

/**
 * Implemented by a view-model that receives navigation parameters. The
 * `RouteHost` calls `onNavigatedTo(params)` BEFORE `activate()`, so the
 * view-model is hydrated before `onActivate()` runs. Routable params arrive
 * from the URL (survive a web refresh); transient params may be `undefined`
 * after a refresh, in which case the view-model reconstructs from the
 * routable id.
 */
export interface NavigationAware<P> {
  onNavigatedTo(params: P): void | Promise<void>;
}

/** Runtime guard: does this view-model accept navigation parameters? */
export function isNavigationAware<P>(vm: unknown): vm is NavigationAware<P> {
  return (
    typeof vm === 'object' &&
    vm !== null &&
    typeof (vm as { onNavigatedTo?: unknown }).onNavigatedTo === 'function'
  );
}
