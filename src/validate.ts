import { Ignore, Never, Try, Undefined } from 'javascriptutilities';
import { NextObserver, Observable, of, Subscription } from 'rxjs';
import { distinctUntilChanged, flatMap, takeUntil } from 'rxjs/operators';
const deepEqual = require('deep-equal');

export type Depn<T> = Readonly<{
  objectStream: Observable<Try<T>>;
  stopStream: Observable<Ignore>;
  errorReceiver: NextObserver<Never<Error>>;
  validateObject: (object: Never<T>) => void;
}>;

/**
 * Synchronizer that performs validation on trigger.
 */
export type Type = Readonly<{
  synchronize: <T>(dependency: Depn<T>) => void;
}>;

export class Impl implements Type {
  private readonly subscription: Subscription;

  public constructor() {
    this.subscription = new Subscription();
  }

  public synchronize<T>(dependency: Depn<T>) {
    this.subscription.add(
      dependency.objectStream
        .pipe(
          distinctUntilChanged((v1, v2) => deepEqual(v1.value, v2.value)),
          flatMap(
            ({ value }): Observable<Undefined<Error>> => {
              try {
                dependency.validateObject(value);
                return of(undefined);
              } catch (e) {
                return of(e);
              }
            }
          ),
          distinctUntilChanged(
            (e1, e2) =>
              (e1 === undefined && e2 === undefined) ||
              (e1 !== undefined &&
                e2 !== undefined &&
                e1.message === e2.message)
          ),
          takeUntil(dependency.stopStream)
        )
        .subscribe(dependency.errorReceiver)
    );
  }
}
