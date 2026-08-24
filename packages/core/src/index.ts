/** Hilt: a small MVVM core for TypeScript applications. */

export type { AppError, ErrorSeverity, OperationResult } from './errors';
export { ErrorCollection, Fail, Ok } from './errors';

export type { AsyncCommandContext, AsyncCommandOptions, Command, CommandOptions } from './command';
export { AsyncCommand, RelayCommand } from './command';

export { DirtyTracker } from './dirty-tracker';

export { assertNever } from './assert-never';

export type { Spec, ValidationFailure } from './validation';
export { ValidationCode, all, any, matches, not } from './validation';

export type { EventBus, EventToken } from './event-bus';
export { RxEventBus, eventToken } from './event-bus';

export type { DeactivationKind, PropertyChange, ViewModel } from './view-model';
export { ViewModelBase } from './view-model-base';

export type { VmNotification, VmNotificationKind } from './view-model-notification';

export type { Conductor } from './conductor';
export { ConductorAllActive, ConductorOneActive } from './conductor';

export type { ReactivePropertyOptions } from './reactive-property';
export { ReactiveProperty } from './reactive-property';

export type { Token } from './token';
export { token } from './token';

export type { FoldSlot, IFoldViewModel } from './fold';
export { assertFoldSlots } from './fold';

export type { DialogResult, IDialogService, IDialogViewModel } from './dialog-service';
export { DialogService } from './dialog-service';

export type { ConfirmCopy, IActionConfirmer, IConfirmDialogViewModel } from './confirm-dialog';
export { ConfirmDialogVM, createActionConfirmer } from './confirm-dialog';

export type { IRouteOverlayService, RouteOverlayKind } from './route-overlay-service';
export { RouteOverlayService } from './route-overlay-service';

export type { INavigationService, NavTarget, NavigationAware } from './navigation';
export { navTarget, isNavigationAware } from './navigation';
