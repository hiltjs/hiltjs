# @hiltjs/core

## 0.1.0

### Minor Changes

- [`1ed3c0c`](https://github.com/rick-dev-creator/hiltjs/commit/1ed3c0c04070f560abd7133303c9c3e9da145eab) - First release of the MVVM kernel: view-model lifecycle, conductors, commands with
  their own busy and error state, reactive properties, an event bus, validation
  specs, and the dialog, navigation and overlay seams.
  
  RxJS is a peer dependency rather than a direct one. Its types are part of the
  public API, so a second nested copy would give you two structurally identical but
  nominally distinct `Observable<T>` and a wall of assignability errors. Install it
  alongside.
