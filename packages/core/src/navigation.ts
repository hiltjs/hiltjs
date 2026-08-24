/** A typed navigation destination. */
export interface NavTarget<P> {
  readonly key: string;
  readonly __p?: P;
}

/** Declare a navigation destination. */
export const navTarget = <P>(key: string): NavTarget<P> => ({ key });

/** VM-first navigation. */
export interface INavigationService {
  navigateTo<P>(target: NavTarget<P>, params: P): void;
  replace<P>(target: NavTarget<P>, params: P): void;
  back(): void;
  readonly canGoBack: boolean;
}

/** Implemented by a view-model that receives navigation parameters. */
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
