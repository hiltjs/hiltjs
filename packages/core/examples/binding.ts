// The binding snippet in README.md. The view-model is only declared here: the
// point is that subscribing is all a renderer has to do, not how it is built.
import type { ErrorCollection } from '../src/index';
import type { ContactSearchViewModel } from './readme';

declare const vm: ContactSearchViewModel;
declare function render(rows: readonly string[]): void;
declare function setSpinnerVisible(busy: boolean): void;
declare function showErrors(errors: ErrorCollection): void;

// README:begin
vm.results.changes$.subscribe(render);
vm.search.isExecuting$.subscribe(setSpinnerVisible);
vm.search.errors$.subscribe(showErrors);
// README:end
