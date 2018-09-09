import {Never, Try} from 'javascriptutilities';
import {
  catchJustReturn,
  flatMapIterable,
  mapNonNilOrEmpty,
} from 'rx-utilities-js';
import {
  asapScheduler,
  merge,
  MonoTypeOperatorFunction,
  NextObserver,
  Observable,
  of,
  SchedulerLike,
  Subscription,
} from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  observeOn,
  share,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import {Depn as ProgressDepn, Type as ProgressSync} from './progress';
type IncludedKeys = 'progressReceiver' | 'stopStream';

export interface BaseDepn extends Pick<ProgressDepn, IncludedKeys> {
  /**
   * If this is true, duplicate params will be filtered out with an operator.
   */
  readonly allowDuplicateParams: boolean;

  readonly description: string;
  readonly errorReceiver: NextObserver<Never<Error>>;
  readonly resultReceiptScheduler?: SchedulerLike;
}

export interface Depn<Param, Result> extends BaseDepn {
  readonly paramStream: Observable<Try<Param>>;
  readonly resultReceiver: NextObserver<Never<Result>>;
  validateParam(param: Param): Error[] | Observable<Error[]>;
  modifyWithParam(params: Param): Observable<Result>;
}

/**
 * Synchronizer that validates and modifies some data on trigger.
 */
export interface Type {
  synchronize<Param, Result>(dependency: Depn<Param, Result>): void;
}

export class Impl implements Type {
  private readonly progressSync: ProgressSync;
  private readonly subscription: Subscription;

  public constructor(progressSync: ProgressSync) {
    this.progressSync = progressSync;
    this.subscription = new Subscription();
  }

  public synchronize<Param, Result>(dependency: Depn<Param, Result>) {
    let subscription = this.subscription;

    let validateStartedStream = dependency.paramStream.pipe(
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
      map(v =>
        v.map(
          (v1): Observable<[Param, Error[]]> => {
            let validated = dependency.validateParam(v1);

            if (validated instanceof Observable) {
              return validated.pipe(
                map((errors): [Param, Error[]] => [v1, errors])
              );
            } else {
              return of([v1, validated] as [Param, Error[]]);
            }
          }
        )
      ),
      observeOn(dependency.resultReceiptScheduler || asapScheduler),
      share()
    );

    let validateCompletedStream = validateStartedStream.pipe(
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

    let argumentFailStream = validateCompletedStream.pipe(
      mapNonNilOrEmpty(v => v.error),
      share()
    );

    let validateFailStream = validateCompletedStream.pipe(
      mapNonNilOrEmpty(({value}) => value),
      filter(v => v[1].length > 0),
      map((v): Error[] => v[1]),
      share()
    );

    let modifyStream = validateCompletedStream.pipe(
      mapNonNilOrEmpty(v => v.value),
      filter(v => v[1].length === 0),
      map(v => v[0]),
      map(v =>
        dependency.modifyWithParam(v).pipe(
          map(v2 => Try.success(v2)),
          catchJustReturn(e => Try.failure(e))
        )
      ),
      share()
    );

    let modifyCompletedStream = modifyStream.pipe(
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
      stopStream: dependency.stopStream,
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
