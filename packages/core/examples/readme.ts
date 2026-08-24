// README:begin
import {
  AsyncCommand,
  ReactiveProperty,
  RelayCommand,
  ViewModelBase,
  eventToken,
  type EventBus,
} from '../src/index';

export const contactSaved = eventToken<{ readonly id: string }>('contact.saved');

export class ContactSearchViewModel extends ViewModelBase {
  readonly query = new ReactiveProperty('');
  readonly results = new ReactiveProperty<readonly string[]>([]);

  constructor(private readonly bus: EventBus) {
    super();
  }

  // Carries its own isExecuting$ / errors$, and aborts the in-flight
  // request when a newer one starts.
  readonly search = new AsyncCommand(
    async (_: void, { signal }) => {
      const response = await fetch(`/contacts?q=${this.query.value}`, { signal });
      this.results.value = (await response.json()) as readonly string[];
    },
    { concurrency: 'switch' },
  );

  readonly clear = new RelayCommand(() => {
    this.query.value = '';
    this.results.value = [];
  });

  // Runs on activate; anything added to `disposables` is disposed on deactivate.
  protected override onActivate(): void {
    this.disposables.add(this.bus.on(contactSaved).subscribe(() => void this.search.execute()));
  }
}
// README:end
