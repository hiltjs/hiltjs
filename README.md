# Hilt

An MVVM framework for TypeScript. A view-model lifecycle you can reason about, commands that carry
their own state, and platform adapters that keep the renderer out of your business logic.

> Not [Hilt for Android](https://dagger.dev/hilt/). Same word, different ecosystem.

## Packages

| Package | Status | |
| --- | --- | --- |
| [`@hiltjs/core`](packages/core) | `0.1` | The MVVM kernel — lifecycle, commands, reactive properties, conductors, event bus. Depends only on RxJS. |
| `@hiltjs/react` | extracting | React binding — hooks, provider, view locator, dialog host. |
| `@hiltjs/expo` | extracting | Expo Router adapter — VM-first navigation, route registry, transitions. |

Start with [`packages/core/README.md`](packages/core/README.md).

## Why it exists

Hilt did not start as a library. It grew as the kernel of a production universal application —
one codebase across iOS, Android and web — where several hundred source files hang off it and its
test suite was written alongside real features rather than retrofitted afterwards.

That origin is the point. The lifecycle contract, the conductors and the dialog and navigation
seams exist because screens in that application needed them and the alternatives were tried first.
It is also why extraction is happening in stages: the core is already free of that application,
and the adapters are not yet.

## Repository

```
packages/core/     @hiltjs/core — the kernel
```

`@hiltjs/core` runs on **Node 20+** — that is what `engines` promises consumers, and CI proves it
by typechecking and testing on that floor. Building it needs **Node 22.18+**, because the bundler
does; the two are separate CI jobs for exactly that reason.

```sh
pnpm install
pnpm run check     # typecheck, test, build
```

Per-package scripts: `build`, `test`, `test:watch`, `typecheck`.

## Roadmap

1. **`@hiltjs/core`** — done; the package builds, and its suite runs in plain Node.
2. **`@hiltjs/react`** — the headless hooks and container wiring separate from the Tamagui-bound
   chrome they currently ship alongside. That separation is the open design question.
3. **`@hiltjs/expo`** — once the adapter stops taking motion constants from the application's
   design system.
4. **Architecture fitness tests and a feature generator** — the pieces that make this a framework
   with an opinion rather than another state library. They exist, but they encode one
   application's module structure today.

## Stability

Everything here is `0.x`: a minor version may contain a breaking change. In exchange, no breaking
change ships without a changelog entry naming it and a note describing the edit required.

## License

[MIT](LICENSE)
