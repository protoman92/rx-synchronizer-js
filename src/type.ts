import {Observable} from 'rxjs';
export type ObservableConvertible<T> =
  | T
  | PromiseLike<T>
  | Promise<T>
  | Observable<T>;
