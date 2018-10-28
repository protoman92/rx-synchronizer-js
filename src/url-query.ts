import {Objects, Omit, Undefined} from 'javascriptutilities';
import {
  MonoTypeOperatorFunction,
  NextObserver,
  Observable,
  SchedulerLike,
} from 'rxjs';
import {debounceTime, distinctUntilChanged, filter} from 'rxjs/operators';
import * as TriggerSync from './trigger';

export type Depn<Query> = Omit<
  TriggerSync.Depn<Query>,
  'triggerReceiver' | 'triggerStream'
> &
  Readonly<{
    /**
     * Only accept the query if the current url matches this pathname.
     */
    acceptableUrlPathName: string;

    /**
     * State may mutate repeatedly, which may rapidly change the displayed url
     * making for ugly UI. This debounce time takes only the last query that
     * is not followed by anything else after a certain time.
     */
    queryDebounceTime?: number;
    asyncOperatorScheduler?: SchedulerLike;

    queryStream: Observable<Query>;
    urlQueryReceiver: NextObserver<Query>;
    currentUrlPathName: () => Undefined<string>;
  }>;

/**
 * Synchronize url query based on current state.
 */
export type Type = Readonly<{
  synchronize: <Query>(dependency: Depn<Query>) => void;
}>;

export class Impl implements Type {
  private readonly triggerSync: TriggerSync.Type;

  public constructor();
  public constructor(triggerSync: TriggerSync.Type);
  public constructor(triggerSync: TriggerSync.Type | undefined = undefined) {
    this.triggerSync = triggerSync ? triggerSync : new TriggerSync.Impl();
  }

  public synchronize<Query>(dependency: Depn<Query>) {
    let deepEqual = require('deep-equal');
    let acceptablePathName = dependency.acceptableUrlPathName;

    this.triggerSync.synchronize<Query>({
      ...Objects.deleteKeys(
        dependency,
        'acceptableUrlPathName',
        'asyncOperatorScheduler',
        'queryDebounceTime',
        'queryStream',
        'currentUrlPathName',
        'urlQueryReceiver'
      ),
      triggerReceiver: dependency.urlQueryReceiver,
      triggerStream: dependency.queryStream.pipe(
        filter(() => acceptablePathName === dependency.currentUrlPathName()),
        ((): MonoTypeOperatorFunction<Query> => {
          const queryDebounce = dependency.queryDebounceTime;

          if (queryDebounce) {
            return obs => obs.pipe(debounceTime(queryDebounce));
          }

          return obs => obs;
        })(),
        distinctUntilChanged((query1, query2) => deepEqual(query1, query2))
      ),
    });
  }
}
