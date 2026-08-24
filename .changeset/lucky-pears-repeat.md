---
'@hiltjs/core': patch
---

Trim the doc comments down to one line per exported symbol. The published
declarations keep an editor tooltip for every export; the multi-paragraph
rationale that used to sit above them is gone, along with references to an
application this package no longer belongs to.

No behaviour changes. `DialogService` also drops a type assertion the compiler
reported as having no effect.
