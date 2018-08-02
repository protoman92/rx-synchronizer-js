import { Ignore, Indeterminate, Nullable, Try } from 'javascriptutilities';
import { NextObserver, Observable, of, Subscription } from 'rxjs';
import { distinctUntilChanged, flatMap, takeUntil } from 'rxjs/operators';
let deepEqual = require('deep-equal');

export interface Depn<T> {
  readonly objectStream: Observable<Try<T>>;
  readonly stopStream: Observable<Ignore>;
  readonly errorReceiver: NextObserver<Nullable<Error>>;
  validateObject(object: Nullable<T>): void;
}

/**
 * Synchronizer that performs validation on trigger.
 */
export interface Type {
  synchronize<T>(dependency: Depn<T>): void;
}

export class Impl implements Type {
  private readonly subscription: Subscription;

  public constructor() {
    this.subscription = new Subscription();
  }

  public synchronize<T>(dependency: Depn<T>) {
    this.subscription.add(dependency.objectStream.pipe(
      distinctUntilChanged((v1, v2) => deepEqual(v1.value, v2.value)),
      flatMap(({ value }): Observable<Indeterminate<Error>> => {
        try {
          dependency.validateObject(value);
          return of(undefined);
        } catch (e) {
          return of(e);
        }
      }),
      distinctUntilChanged((e1, e2) => (e1 === undefined && e2 === undefined) ||
        (e1 !== undefined && e2 !== undefined && e1.message === e2.message)),
      takeUntil(dependency.stopStream),
    ).subscribe(dependency.errorReceiver));
  }
}
