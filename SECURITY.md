# Security policy

## Supported versions

The project is pre-1.0. Only the most recent published version of each package
receives fixes; there are no maintained release branches yet.

| Package        | Supported            |
| -------------- | -------------------- |
| `@hiltjs/core` | latest `0.x` release |

## Reporting a vulnerability

**Please do not open a public issue.**

Use GitHub's private vulnerability reporting instead: go to the
[Security tab](https://github.com/rick-dev-creator/hiltjs/security/advisories/new)
and open a draft advisory. It is private between you and the maintainers, and it
is the only channel monitored for this.

Useful things to include, if you have them: what an attacker can do, the affected
version, and the smallest reproduction you can manage.

You should get a first response within a week. If a report is confirmed, the fix
and the advisory are published together, and you will be credited unless you
would rather not be.

## Scope

`@hiltjs/core` has no network, filesystem or storage access. It is a set of
in-process building blocks, so the realistic vulnerability classes here are
prototype pollution, denial of service through unbounded growth, and anything in
the published artifact that does not match this source tree. Reports about the
build and release pipeline are in scope for that last reason.
