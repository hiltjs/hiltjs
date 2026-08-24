# @hiltjs/core

A small MVVM core for TypeScript — view-model lifecycle, commands, reactive properties, conductors
and an event bus, built on RxJS. No UI framework anywhere in it.

> Not [Hilt for Android](https://dagger.dev/hilt/). Same word, different ecosystem.

```sh
npm install @hiltjs/core rxjs
```

RxJS is a **peer** dependency, on purpose: its types are part of this package's public API, so
there has to be exactly one copy of it and you are the one who supplies it.

## What it is for

Most state libraries answer *where does the data live*. Hilt answers a different question: **what
is the lifecycle of a screen, and who owns it.**

- A **view-model** that knows when it is active, and tears its subscriptions down when it is not.
- **Commands** that carry their own busy, enabled and error state — so a button binds to one object
  instead of three loose booleans, and cancellation is built in.
- **Conductors**, for when one view-model owns others and their lifecycles have to nest correctly.
- **Seams** — dialogs, navigation, an event bus — so a view-model can ask for a modal or move to
  another screen without ever knowing what a router or a component is.

The contract is shaped after Caliburn.Micro's `Activate` / `Deactivate` lifecycle, adapted to
TypeScript and RxJS.

## A view-model

```ts
import {
  AsyncCommand,
  ReactiveProperty,
  RelayCommand,
  ViewModelBase,
  eventToken,
  type EventBus,
} from '@hiltjs/core';

export const contactSaved = eventToken<{ readonly id: string }>('contact.saved');

export class ContactSearchViewModel extends ViewModelBase {
  readonly query = new ReactiveProperty('');
  readonly results = new ReactiveProperty<readonly string[]>([]);

  constructor(private readonly bus: EventBus) {
    super();
  }

  // Carries its own isExecuting$ / errors$, and aborts the in-flight
  // request when a newer one starts.
  readonly search = new AsyncCommand(
    async (_: void, { signal }) => {
      const response = await fetch(`/contacts?q=${this.query.value}`, { signal });
      this.results.value = (await response.json()) as readonly string[];
    },
    { concurrency: 'switch' },
  );

  readonly clear = new RelayCommand(() => {
    this.query.value = '';
    this.results.value = [];
  });

  // Runs on activate; anything added to `disposables` is disposed on deactivate.
  protected override onActivate(): void {
    this.disposables.add(this.bus.on(contactSaved).subscribe(() => void this.search.execute()));
  }
}
```

Binding is just subscribing — the view-model has no idea a view exists:

```ts
const vm = new ContactSearchViewModel(bus);
void vm.activate();

vm.results.changes$.subscribe(render);
vm.search.isExecuting$.subscribe(setSpinnerVisible);
vm.search.errors$.subscribe(showErrors);
```

## What is in the box

| | |
| --- | --- |
| **Lifecycle** | `ViewModel`, `ViewModelBase`, `DeactivationKind`, `PropertyChange` |
| **Composition** | `Conductor`, `ConductorOneActive`, `ConductorAllActive` |
| **State** | `ReactiveProperty`, `DirtyTracker` |
| **Actions** | `Command`, `RelayCommand`, `AsyncCommand` |
| **Results & errors** | `OperationResult`, `Ok`, `Fail`, `AppError`, `ErrorCollection` |
| **Messaging** | `EventBus`, `RxEventBus`, `eventToken` |
| **Notifications** | `VmNotification`, `VmNotificationKind` |
| **Validation** | `Spec`, `all`, `any`, `not`, `matches`, `ValidationCode` |
| **Seams** | `IDialogService`, `DialogService`, `IRouteOverlayService`, `INavigationService`, `IActionConfirmer` |
| **Progressive disclosure** | `IFoldViewModel`, `FoldSlot`, `assertFoldSlots` |
| **Identity** | `Token`, `token` |

## Design rules

These are the constraints the package is built to, not aspirations:

- **The kernel never imports a UI framework.** No React, no DOM, no renderer. Where a type would
  have to name a component, it is `unknown` and the adapter narrows it once.
- **View-models are testable without a view.** Every one of the tests in this package runs in plain
  Node, with no renderer and no DOM.
- **A view never re-derives what the view-model decided.** Contracts expose the answer, not the
  ingredients.

## Status

`0.1` — the core, alone. React and Expo adapters are being extracted next; until then, binding is
whatever your renderer does with an `Observable`.

Until `1.0`, a minor version may contain a breaking change. In exchange: no breaking change ships
without a changelog entry naming it and a note describing the edit.

## License

MIT
