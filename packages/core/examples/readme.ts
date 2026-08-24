import {
  AsyncCommand,
  ReactiveProperty,
  RelayCommand,
  ViewModelBase,
  eventToken,
  RxEventBus,
  type EventBus,
} from '../src/index';

export const contactSaved = eventToken<{ readonly id: string }>('contact.saved');

export class ContactSearchViewModel extends ViewModelBase {
  readonly query = new ReactiveProperty('');
  readonly results = new ReactiveProperty<readonly string[]>([]);

  constructor(private readonly bus: EventBus) {
    super();
  }

  readonly search = new AsyncCommand(async (_: void, { signal }) => {
    const response = await fetch(`/contacts?q=${this.query.value}`, { signal });
    this.results.value = (await response.json()) as readonly string[];
  }, { concurrency: 'switch' });

  readonly clear = new RelayCommand(() => {
    this.query.value = '';
    this.results.value = [];
  });

  protected override onActivate(): void {
    this.disposables.add(this.bus.on(contactSaved).subscribe(() => void this.search.execute()));
  }
}

const vm = new ContactSearchViewModel(new RxEventBus());
void vm.activate();
vm.results.changes$.subscribe((rows) => console.log(rows.length));
vm.search.isExecuting$.subscribe((busy) => console.log(busy));
