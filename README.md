# Hilt

[![npm](https://img.shields.io/npm/v/@hiltjs/core?logo=npm&color=cb3837)](https://www.npmjs.com/package/@hiltjs/core)
[![CI](https://github.com/hiltjs/hiltjs/actions/workflows/ci.yml/badge.svg)](https://github.com/hiltjs/hiltjs/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@hiltjs/core)](LICENSE)

MVVM for TypeScript, taken seriously. Screens with a real lifecycle, commands that carry their own
state, conductors that own their children, and platform adapters that keep the renderer out of your
application logic.

**Inspired by [Caliburn.Micro](https://caliburnmicro.com/)**, whose lifecycle contract it carries
over from WPF, Silverlight and UWP into TypeScript and RxJS.

> Not [Hilt for Android](https://dagger.dev/hilt/). Same word, different ecosystem.

## Install

```sh
npm install @hiltjs/core rxjs
```

RxJS is a peer dependency, not a direct one: its types are part of the public API, so there has to
be exactly one copy in your tree and you are the one who picks it.

## The short version

I come from WPF, Silverlight and UWP. In that world you built applications with MVVM, and
[Caliburn.Micro](https://caliburnmicro.com/) was the framework that did it best. A screen knew when
it was activated and when it was closed. A conductor owned its children. Screens talked to each
other through an event aggregator instead of holding references. A view-model could open a dialog
without knowing what a window was.

When I moved to TypeScript, none of that existed as one thing. The pieces were spread across many
libraries, each solving one of them, and none of them handled lifecycle the same way. So I wrote it
myself, inside an application I was already shipping. This repository is that code, taken back out.

I build applications that are large and have to keep working for years, and two things follow from
that.

**Folders are not architecture.** React projects are usually organised by feature folders, and that
gets called the architecture. Nothing enforces it. A rule that is only a convention gets broken the
first time someone is in a hurry, and nobody notices until much later. A boundary is only real if
crossing it fails the build.

**UI frameworks are technical debt by default.** I shipped products on Silverlight and on UWP.
Microsoft ended both. JavaScript is no different: Next.js changed its own model, Remix became React
Router, and the recommended way to do most things has been replaced more than once. So I assume that
whatever UI framework I pick will change or die, and I keep the code that took longest to write out
of its reach.

That is what Hilt is for. View-models are plain TypeScript objects with a lifecycle, and they do not
import React. When the UI framework changes, I replace an adapter and the application logic stays
where it is.

The long version, with the code, is in [`packages/core/README.md`](packages/core/README.md).

## Packages

| Package                         | Status     |                                                                                                                                 |
| ------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [`@hiltjs/core`](packages/core) | `0.1`      | The kernel. Lifecycle, commands, reactive properties, conductors, event bus, dialog and navigation seams. Depends only on RxJS. |
| `@hiltjs/react`                 | extracting | React binding. Hooks, provider, view locator, dialog host.                                                                      |
| `@hiltjs/expo`                  | extracting | Expo Router adapter. VM-first navigation, route registry, transitions.                                                          |

## Why the packages arrive one at a time

Hilt did not start as a library. It grew as the kernel of a production universal application, one
codebase across iOS, Android and web, where several hundred source files hang off it and the tests
were written next to real features instead of bolted on afterwards.

That is the good part, and it is also the reason this is being extracted in stages. The kernel is
already free of that application. The React adapter is not: half of it is framework, and half is
chrome written against a specific UI library. The Expo adapter still borrows animation constants
from that application's design system.

Publishing all three today would mean either shipping that coupling to you, or deciding how to
remove it in an afternoon because a release was waiting. Neither is a good trade, and the kernel is
useful on its own in the meantime.

## Working on it

```sh
pnpm install
pnpm run check     # typecheck, test, build
```

`@hiltjs/core` runs on **Node 20+**. That is what `engines` promises, and CI proves it by
typechecking and running the suite on that floor. Building needs **Node 22.18+**, because the
bundler does. They are separate CI jobs for exactly that reason.

Per-package scripts: `build`, `test`, `test:watch`, `typecheck`.

CI also typechecks the example printed in the package README, so it cannot quietly rot, and it
checks the packed tarball itself rather than trusting the config: no sources or tests inside, RxJS
left external, and both entry points actually importable.

## Roadmap

1. **`@hiltjs/core`.** Done. Builds, and its suite runs in plain Node.
2. **`@hiltjs/react`.** Split the headless hooks and container wiring away from the UI-library-bound
   chrome they currently ship with. That split is the open design question, not a chore.
3. **`@hiltjs/expo`.** Once the adapter stops reaching into an application's design system.
4. **Architecture fitness tests and a feature generator.** These are the pieces that make Hilt a
   framework with an opinion instead of another state library: tests that fail when a view-model
   grows a shape it shouldn't, and a generator that scaffolds the canonical one. They exist. They
   currently encode one application's module structure, which is why they are last.

## Contributing

Issues describing a problem are welcome, and often more useful than a pull
request fixing it a particular way while the shape of the project is still being
decided. [CONTRIBUTING.md](CONTRIBUTING.md) covers the setup, the gate, and the
rules the kernel keeps. Security issues go through
[SECURITY.md](SECURITY.md), not the issue tracker.

## Stability

Everything here is `0.x`, so a minor version may contain a breaking change. In exchange, no breaking
change ships without a changelog entry naming it and a note describing the edit you'll need to make.

## License

[MIT](LICENSE)
