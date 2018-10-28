import {Never, Try} from 'javascriptutilities';
import {catchJustReturn, mapNonNilOrEmpty} from 'rx-utilities-js';
import {
  asyncScheduler,
  MonoTypeOperatorFunction,
  NextObserver,
  Observable,
  of,
  OperatorFunction,
  SchedulerLike,
  Subscription,
  ObservableInput,
} from 'rxjs';
import {
  distinctUntilChanged,
  map,
  observeOn,
  share,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import * as ProgressSync from './progress';
import {createObservable} from './sync-util';

export type BaseDepn = Pick<
  ProgressSync.Depn,
  'progressReceiver' | 'stopStream'
> &
  Readonly<{
    /**
     * If this is true, duplicate params will be filtered out with an operator.
     * Beware that in the case of multiple triggers, the behavior of the stream
     * may be unexpected.
     */
    allowDuplicateParams: boolean;

    /**
     * If this is true, invalid results will not be filtered out.
     */
    allowInvalidResult: boolean;

    description: string;
    errorReceiver: NextObserver<Never<Error>>;
    resultReceiptScheduler?: SchedulerLike;
  }>;

export type Depn<Param, Result> = BaseDepn &
  Readonly<{
    paramStream: Observable<Try<Param>>;
    resultReceiver: NextObserver<Never<Result>>;
    fetchWithParam: (params: Param) => ObservableInput<Result>;
  }>;

/**
 * Synchronizer that fetches some data on trigger.
 */
export type Type = Readonly<{
  synchronize: <Param, Result>(dependency: Depn<Param, Result>) => void;
}>;

export class Impl implements Type {
  private readonly progressSync: ProgressSync.Type;
  private readonly subscription: Subscription;

  public constructor();
  public constructor(progressSync: ProgressSync.Type);
  public constructor(progressSync?: ProgressSync.Type) {
    this.progressSync = progressSync || new ProgressSync.Impl();
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

          return v =>
            v.pipe(
              distinctUntilChanged((v1, v2) => {
                return deepEqual(v1.value, v2.value);
              })
            );
        }
      })(),
      map(param => {
        try {
          let actualParam = param.getOrThrow();

          return createObservable(dependency.fetchWithParam(actualParam)).pipe(
            map(v1 => Try.success(v1)),
            catchJustReturn(e => Try.failure(e))
          );
        } catch (e) {
          return of(Try.failure(e));
        }
      }),
      ((): MonoTypeOperatorFunction<Observable<Try<Result>>> => {
        if (dependency.resultReceiptScheduler) {
          return observeOn(dependency.resultReceiptScheduler);
        } else {
          return observeOn(asyncScheduler);
        }
      })(),
      share()
    );

    let fetchCompletedStream = fetchStream.pipe(
      switchMap(v => v),
      share()
    );

    subscription.add(
      fetchCompletedStream
        .pipe(
          ((): OperatorFunction<Try<Result>, Never<Result>> => {
            if (dependency.allowInvalidResult) {
              return v => v.pipe(map(({value}) => value));
            } else {
              return v => v.pipe(mapNonNilOrEmpty(({value}) => value));
            }
          })(),
          takeUntil(dependency.stopStream)
        )
        .subscribe(dependency.resultReceiver)
    );

    subscription.add(
      fetchCompletedStream
        .pipe(
          map(({error}) => error),
          takeUntil(dependency.stopStream)
        )
        .subscribe(dependency.errorReceiver)
    );

    this.progressSync.synchronize({
      progressReceiver: dependency.progressReceiver,
      progressStartStream: fetchStream.pipe(map((): true => true)),
      progressEndStream: fetchCompletedStream.pipe(map((): false => false)),
      stopStream: dependency.stopStream,
    });
  }
}
