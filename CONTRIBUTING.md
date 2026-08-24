# Contributing

Thanks for looking. This is a young project and the shape of it is still being
decided, so an issue describing the problem you hit is often worth more than a
pull request fixing it a particular way.

## Getting set up

You need **Node 22.18 or newer** and **pnpm**. Node 20 is enough to _use_
`@hiltjs/core`, and CI tests on it, but the bundler that builds the package needs
22.18.

```sh
pnpm install
pnpm run check
```

`pnpm run check` is the gate. It runs, in order: typecheck, lint, format check,
README example check, tests, build. CI runs the same thing, so if it passes
locally it passes there.

Individual pieces, when you want a faster loop:

```sh
pnpm run typecheck
pnpm run lint          # pnpm run lint:fix to autofix
pnpm run format        # rewrites files; format:check only reports
pnpm --filter @hiltjs/core test:watch
```

## Rules the kernel keeps

These are not style preferences. A pull request that breaks one of them will be
asked to change, so it is worth knowing them before you write code.

**`@hiltjs/core` imports nothing that renders.** No React, no DOM, no framework,
not even as a type. If a contract needs to refer to a component, it types it as
`unknown` and the platform adapter narrows it in one place. The whole value of
the package is that it survives its renderer.

**Everything is testable without a view.** Every test in the kernel runs in plain
Node with no DOM and no test renderer. If your change can only be verified by
mounting something, the design needs another look rather than the test.

**Assertions must be able to fail.** An assertion on a value nothing ever sets is
worse than no assertion, because it reads as coverage. If you are unsure whether
a test is load-bearing, break the code it covers on purpose and check that it
goes red.

**Views do not re-derive what a view-model decided.** Contracts expose the answer
rather than the ingredients.

## Changesets

Any change that affects a published package needs one:

```sh
pnpm changeset
```

Choose the bump and describe the change from the point of view of somebody using
the package. That text becomes the changelog entry. While the project is on
`0.x`, breaking changes are allowed in a minor, and this is the only thing that
keeps them from being silent, so please do not skip it.

Changes that touch nothing published (CI, docs, this file) do not need one.

## README examples are compiled

The code samples in a package README are not prose. They live in
`packages/*/examples/`, are typechecked by CI, and `scripts/check-readme-examples.mjs`
asserts the README prints them verbatim, so the two cannot drift.

To change a sample, edit the file in `examples/` and paste the region between the
`// README:begin` and `// README:end` markers into the README. The only permitted
difference is the import specifier, since an example inside the repo imports from
source and a reader imports the package.

## Pull requests

Explain what problem the change solves before how it solves it. If the reasoning
lives in the commit message rather than a comment, the next person reading the
code will not find it, so prefer putting the "why" next to the code.

Keep unrelated formatting out of the diff. The formatter runs on the whole repo,
so if you find yourself reformatting a file you did not otherwise touch,
something is off.

## Reporting a security issue

Do not open a public issue. See [SECURITY.md](SECURITY.md).
