import {from, Observable} from 'rxjs';
import {ObservableConvertible} from './type';

export function createObservable<T>(source: ObservableConvertible<T>) {
  if (source instanceof Observable) {
    return source;
  }
  if (source instanceof Promise) {
    return from(source);
  } else {
    return from(Promise.resolve(source));
  }
}
