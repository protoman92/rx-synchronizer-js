import { Never, Try } from 'javascriptutilities';
import {
  catchJustReturn,
  flatMapIterable,
  mapNonNilOrEmpty
} from 'rx-utilities-js';
import {
  asapScheduler,
  merge,
  MonoTypeOperatorFunction,
  NextObserver,
  Observable,
  ObservableInput,
  of,
  SchedulerLike,
  Subscription
} from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  observeOn,
  share,
  switchMap,
  takeUntil
} from 'rxjs/operators';
import * as ProgressSync from './progress';
import { createObservable } from './sync-util';
import deepEqual = require('deep-equal');

export type BaseDepn = Pick<
  ProgressSync.Depn,
  'progressReceiver' | 'stopStream'
> &
  Readonly<{
    /**
     * If this is true, duplicate params will be filtered out with an operator.
     */
    allowDuplicateParams: boolean;

    description: string;
    errorReceiver: NextObserver<Never<Error>>;
    resultReceiptScheduler?: SchedulerLike;
  }>;

export type Depn<Param, Result> = BaseDepn &
  Readonly<{
    paramStream: Observable<Try<Param>>;
    resultReceiver: NextObserver<Never<Result>>;
    validateParam: (param: Param) => Error[] | Observable<Error[]>;
    modifyWithParam: (params: Param) => ObservableInput<Result>;
  }>;

/**
 * Synchronizer that validates and modifies some data on trigger.
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
    const subscription = this.subscription;

    const validateStartedStream = dependency.paramStream.pipe(
      ((): MonoTypeOperatorFunction<Try<Param>> => {
        if (dependency.allowDuplicateParams) {
          return v => v;
        }

        return v =>
          v.pipe(
            distinctUntilChanged((v1, v2) => {
              return deepEqual(v1.value, v2.value);
            })
          );
      })(),
      map(v =>
        v.map(
          (v1): Observable<[Param, Error[]]> => {
            const validated = dependency.validateParam(v1);

            if (validated instanceof Observable) {
              return validated.pipe(
                map((errors): [Param, Error[]] => [v1, errors])
              );
            }

            return of([v1, validated] as [Param, Error[]]);
          }
        )
      ),
      observeOn(dependency.resultReceiptScheduler || asapScheduler),
      share()
    );

    const validateCompletedStream = validateStartedStream.pipe(
      switchMap((v: Try<Observable<[Param, Error[]]>>) => {
        try {
          return v.getOrThrow().pipe(
            map(v1 => Try.success(v1)),
            catchJustReturn(e => Try.failure(e))
          );
        } catch (e) {
          return of(Try.failure<[Param, Error[]]>(e));
        }
      }),
      share()
    );

    const argumentFailStream = validateCompletedStream.pipe(
      mapNonNilOrEmpty(v => v.error),
      share()
    );

    const validateFailStream = validateCompletedStream.pipe(
      mapNonNilOrEmpty(({ value }) => value),
      filter(v => v[1].length > 0),
      map((v): Error[] => v[1]),
      share()
    );

    const modifyStream = validateCompletedStream.pipe(
      mapNonNilOrEmpty(v => v.value),
      filter(v => v[1].length === 0),
      map(v => v[0]),
      map(v =>
        createObservable(dependency.modifyWithParam(v)).pipe(
          map(v2 => Try.success(v2)),
          catchJustReturn(e => Try.failure(e))
        )
      ),
      share()
    );

    const modifyCompletedStream = modifyStream.pipe(
      switchMap(v => v),
      share()
    );

    this.progressSync.synchronize({
      progressReceiver: dependency.progressReceiver,
      progressStartStream: validateStartedStream.pipe(map((): true => true)),
      progressEndStream: merge(
        argumentFailStream,
        validateFailStream,
        modifyCompletedStream
      ).pipe(map((): false => false)),
      stopStream: dependency.stopStream
    });

    subscription.add(
      modifyCompletedStream
        .pipe(
          mapNonNilOrEmpty(v => v.value),
          takeUntil(dependency.stopStream)
        )
        .subscribe(dependency.resultReceiver)
    );

    subscription.add(
      merge(
        argumentFailStream,
        validateFailStream.pipe(flatMapIterable(v => v)),
        modifyCompletedStream.pipe(mapNonNilOrEmpty(v => v.error))
      )
        .pipe(takeUntil(dependency.stopStream))
        .subscribe(dependency.errorReceiver)
    );
  }
}
