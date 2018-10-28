import {from, ObservableInput} from 'rxjs';

export function createObservable<T>(source: ObservableInput<T>) {
  return from(source);
}
