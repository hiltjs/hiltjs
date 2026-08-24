# @hiltjs/core

## 0.1.1

### Patch Changes

- [`75709ac`](https://github.com/rick-dev-creator/hiltjs/commit/75709ac31d102cf90997cb0fe0d14104b384b300) - Trim the doc comments down to one line per exported symbol. The published
  declarations keep an editor tooltip for every export; the multi-paragraph
  rationale that used to sit above them is gone, along with references to an
  application this package no longer belongs to.
  
  No behaviour changes. `DialogService` also drops a type assertion the compiler
  reported as having no effect.

## 0.1.0

### Minor Changes

- [`1ed3c0c`](https://github.com/rick-dev-creator/hiltjs/commit/1ed3c0c04070f560abd7133303c9c3e9da145eab) - First release of the MVVM kernel: view-model lifecycle, conductors, commands with
  their own busy and error state, reactive properties, an event bus, validation
  specs, and the dialog, navigation and overlay seams.
  
  RxJS is a peer dependency rather than a direct one. Its types are part of the
  public API, so a second nested copy would give you two structurally identical but
  nominally distinct `Observable<T>` and a wall of assignability errors. Install it
  alongside.
