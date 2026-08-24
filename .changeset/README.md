# Changesets

Every change that affects a published package needs a changeset. Run:

```sh
pnpm changeset
```

Pick the packages, pick the bump, and write what changed from the point of view
of somebody using the package. That text becomes the changelog entry, and while
this project is on `0.x` it is the only thing standing between a breaking change
and a silent one.
