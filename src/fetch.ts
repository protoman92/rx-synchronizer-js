import { Indeterminate, Nullable, Try } from 'javascriptutilities';
import { catchJustReturn, mapNonNilOrEmpty } from 'rx-utilities-js';
import { asapScheduler, merge, MonoTypeOperatorFunction, NextObserver, Observable, OperatorFunction, SchedulerLike, Subscription } from 'rxjs';
import { distinctUntilChanged, map, observeOn, share, switchMap, takeUntil } from 'rxjs/operators';

export interface BaseDepn {
  /**
   * If this is true, duplicate params will be filtered out with an operator.
   * Beware that in the case of multiple triggers, the behavior of the stream
   * may be unexpected.
   */
  readonly allowDuplicateParams: boolean;

  /**
   * If this is true, invalid results will not be filtered out.
   */
  readonly allowInvalidResult: boolean;

  readonly description: string;
  readonly errorReceiver: NextObserver<Nullable<Error>>;
  readonly progressReceiver: NextObserver<boolean>;
  readonly stopStream: Observable<any>;
  readonly resultReceiptScheduler?: SchedulerLike;
}

export interface Depn<Param, Result> extends BaseDepn {
  readonly paramStream: Observable<Try<Param>>;
  readonly resultReceiver: NextObserver<Nullable<Result>>;
  fetchWithParam(params: Param): Observable<Result>;
}

/**
 * Synchronizer that fetches some data on trigger.
 */
export interface Type {
  synchronize<Param, Result>(dependency: Depn<Param, Result>): void;
}

export class Impl implements Type {
  private subscription: Subscription;

  public constructor() {
    this.subscription = new Subscription();
  }

  public synchronize<Param, Result>(dependency: Depn<Param, Result>) {
    let subscription = this.subscription;

    let fetchStream = dependency.paramStream.pipe(
      ((): MonoTypeOperatorFunction<Try<Param>> => {
        if (dependency.allowDuplicateParams) {
          return v => v;
        } else {
          let deepEqual = require('deep-equal');

          return v => v.pipe(distinctUntilChanged((v1, v2) => {
            return deepEqual(v1.value, v2.value);
          }));
        }
      })(),
      mapNonNilOrEmpty(({ value }): Indeterminate<Param> => value),
      map(v => dependency.fetchWithParam(v).pipe(
        map(v1 => Try.success(v1)),
        catchJustReturn(e => Try.failure(e))),
      ),
      observeOn(dependency.resultReceiptScheduler || asapScheduler),
      share(),
    );

    let fetchCompletedStream = fetchStream.pipe(switchMap(v => v), share());

    subscription.add(fetchCompletedStream
      .pipe(
        ((): OperatorFunction<Try<Result>, Nullable<Result>> => {
          if (dependency.allowInvalidResult) {
            return v => v.pipe(map(({ value }) => value));
          } else {
            return v => v.pipe(mapNonNilOrEmpty(({ value }) => value));
          }
        })(),
        takeUntil(dependency.stopStream))
      .subscribe(dependency.resultReceiver));

    subscription.add(fetchCompletedStream
      .pipe(map(({ error }) => error), takeUntil(dependency.stopStream))
      .subscribe(dependency.errorReceiver));

    subscription.add(merge(
      fetchStream.pipe(map(() => true)),
      fetchCompletedStream.pipe(map(() => false)),
    ).pipe(takeUntil(dependency.stopStream)
    ).subscribe(dependency.progressReceiver));
  }
}
