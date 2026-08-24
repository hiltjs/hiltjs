# @hiltjs/core

A view-model has a lifecycle. It knows when it becomes active and when it stops being active, it
cleans up after itself, and it is allowed to refuse to close. A command knows whether it can run
right now, whether it is running, and what went wrong when it didn't. A conductor owns its children,
and their lifecycles nest inside its own.

If that vocabulary sounds familiar, you probably wrote XAML at some point. That is exactly where it
comes from.

> Not [Hilt for Android](https://dagger.dev/hilt/). Same word, different ecosystem.

## Where this comes from

I come from WPF, Silverlight and UWP. In that world MVVM was not something you argued about, it was
how applications were built, and [Caliburn.Micro](https://caliburnmicro.com/) was the framework that
did it best.

What it gave you was not data binding. It was a set of names for things every application needs. A
`Screen` with `OnActivate` and `OnDeactivate`, so a screen could set itself up and clean itself up.
A `Conductor` that owned its children, so closing a parent closed what it held. An event aggregator,
so two screens could talk without holding references to each other. An `IWindowManager`, so a
view-model could open a dialog without knowing what a window was.

The result is that your application logic ends up as ordinary objects. You can create one in a test,
call methods on it, and check what happened, with no UI running at all.

When I moved to TypeScript, none of that was available as one thing. The individual ideas exist,
scattered across many libraries, but each one solves a piece and none of them agree on lifecycle.
Most state libraries answer where the data lives. Very few answer when a screen starts, when it
stops, and who is responsible for it.

So Hilt is those names, in TypeScript. The lifecycle contract is Caliburn.Micro's. The rest is what
RxJS and structural types make possible that C# and `INotifyPropertyChanged` did not.

## Folders are not architecture

React projects are usually organised by feature folders, and that gets called the architecture.
On a small codebase it is enough.

On a large one that has to keep working for years, it is not, because nothing enforces it. A folder
boundary is a convention, and conventions get broken the first time someone is in a hurry. Usually
nobody notices until much later, when the dependency already runs in both directions.

A boundary is only real if crossing it fails: code that will not compile, a dependency the container
cannot resolve, a test that goes red. Hilt is built from those, not from directory names.

## Why the kernel does not know React exists

I shipped products on Silverlight and on UWP. Microsoft ended both. Neither was a bad choice at the
time, which is the part worth paying attention to.

JavaScript works the same way. Next.js changed its own model, Remix became React Router, and the
recommended way to do most things has been replaced more than once. So I assume that whatever UI
framework I pick will change or die, and I plan for it instead of hoping.

That is what I mean by treating UI frameworks as technical debt by default. It is not a complaint
about React. It is a statement about how long this kind of dependency lasts, and the question is
never whether it changes but what the change costs.

MVVM is my answer. If the application logic is ordinary objects with a lifecycle and no reference to
a view, a framework ending costs you an adapter. If the same logic lives inside components, hooks
and a router's conventions, it costs you the application.

So this package depends on nothing that renders, and it never will.

### If you already know Caliburn.Micro

| Caliburn.Micro | Hilt |
| --- | --- |
| `Screen`, `OnActivate` / `OnDeactivate` | `ViewModelBase`, `onActivate` / `onDeactivate` |
| `IGuardClose.CanClose` | `canDeactivate()` |
| `Conductor<T>.Collection.OneActive` | `ConductorOneActive<T>` |
| `Conductor<T>.Collection.AllActive` | `ConductorAllActive<T>` |
| `PropertyChangedBase`, `NotifyOfPropertyChange` | `ReactiveProperty<T>` |
| `ICommand` + the `CanX` guard convention | `RelayCommand` / `AsyncCommand`, with `canExecute$` |
| `IEventAggregator`, `IHandle<T>` | `EventBus`, `eventToken<T>()` |
| `IWindowManager.ShowDialog` | `IDialogService` |
| `ViewLocator` | `ViewLocator` (in `@hiltjs/react`) |
| `SimpleContainer` + bootstrapper | `Token` + a container adapter |

Three differences worth knowing. Properties are explicit `ReactiveProperty` objects rather than a
magic base class, because there is no `[CallerMemberName]` to lean on, and being explicit turned out
to read better anyway. Guards are observables instead of `CanX` properties plus
`NotifyOfPropertyChange`. And async commands come with an `AbortSignal`, which is the thing I always
wished `DelegateCommand` had.

## Install

```sh
npm install @hiltjs/core rxjs
```

RxJS is a **peer** dependency on purpose. Its types are part of this package's public API. The
declarations literally open with `import { Observable } from "rxjs"`, so there needs to be exactly
one copy of it in your tree, and you are the one who decides which.

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

That is the whole class. No component, no store, no provider, and nothing in it that knows a view
exists. Testing it needs no test renderer and no DOM:

```ts
const vm = new ContactSearchViewModel(bus);
await vm.activate();

vm.query.value = 'ada';
await vm.search.execute();

expect(vm.results.value).toHaveLength(1);
```

Binding, when you get there, is subscribing:

```ts
vm.results.changes$.subscribe(render);
vm.search.isExecuting$.subscribe(setSpinnerVisible);
vm.search.errors$.subscribe(showErrors);
```

The React package turns those three lines into hooks, and is being extracted next. Until then you
subscribe the way your renderer normally subscribes to an observable.

## What's in the box

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
| **Seams** | `IDialogService`, `IRouteOverlayService`, `INavigationService`, `IActionConfirmer` |
| **Progressive disclosure** | `IFoldViewModel`, `FoldSlot`, `assertFoldSlots` |
| **Identity** | `Token`, `token` |

## Three rules it actually keeps

**The kernel never imports a UI framework.** No React, no DOM, no renderer, not even as a type.
Where a contract would otherwise have to name a component, it says `unknown` and the platform
adapter narrows it exactly once. This is what lets one view-model run on iOS, Android and the web
without knowing which it is on, and it is the point made above: the renderer is the piece most
likely to be replaced, so it is the piece that should know the least.

**View-models are testable without a view.** Not "testable in principle". Every test in this package
runs in plain Node with no renderer and no DOM, and there are 131 of them. If a design required a
component to be mounted before it could be verified, the design was changed.

**A view never re-derives what the view-model decided.** Contracts hand over the answer, not the
ingredients. The moment a view starts computing "well, the list is empty, so probably...", you have
two sources of truth and one of them is about to be wrong.

## Status

`0.1`, and it is the kernel alone. `@hiltjs/react` and `@hiltjs/expo` are being extracted from the
application this grew inside. The code exists and is in production. What it needs is to stop
depending on that application before it can be published honestly.

Until `1.0`, a minor version may break something. In exchange: no breaking change ships without a
changelog entry naming it and a note telling you what to edit.

## License

MIT
