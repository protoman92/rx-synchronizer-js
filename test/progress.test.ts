import { Impl as FetchSync } from 'fetch';
import { Booleans, Ignore, IGNORE, Numbers, Try } from 'javascriptutilities';
import { Depn as ProgressDepn, Impl as ProgressSync } from 'progress';
import { doOnCompleted, doOnNext } from 'rx-utilities-js';
import {
  asapScheduler,
  NEVER,
  NextObserver,
  of,
  Subject,
  throwError,
  timer,
  zip
} from 'rxjs';
import { anything, capture, instance, spy, verify, when } from 'ts-mockito-2';
import { asyncWait, asyncTimeout } from './test-util';

describe('Progress sync should work correctly', () => {
  let dependency: ProgressDepn;
  let progressSync: ProgressSync;
  let progressReceiver: NextObserver<boolean>;

  beforeEach(() => {
    progressReceiver = spy({ next: () => {} });

    dependency = spy<ProgressDepn>({
      progressReceiver: { ...instance(progressReceiver) },
      progressStartStream: NEVER,
      progressEndStream: NEVER,
      stopStream: NEVER
    });

    progressSync = new ProgressSync();
  });

  it(
    'Triggering progress events - should emit flags sequentially',
    done => {
      /// Setup
      const progressStartStream = new Subject<true>();
      const progressEndStream = new Subject<false>();
      when(dependency.progressStartStream).thenReturn(progressStartStream);
      when(dependency.progressEndStream).thenReturn(progressEndStream);
      progressSync.synchronize(instance(dependency));

      /// When
      progressStartStream.next(true);
      progressEndStream.next(false);

      /// Then
      setTimeout(() => {
        verify(progressReceiver.next(anything())).twice();
        verify(progressReceiver.next(true)).calledBefore(
          progressReceiver.next(false)
        );
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Sending stop signal - should unsubscribe all streams',
    done => {
      /// Setup
      const progressStartStream = new Subject<true>();
      const progressEndStream = new Subject<false>();
      const stopStream = new Subject<Ignore>();
      when(dependency.progressStartStream).thenReturn(progressStartStream);
      when(dependency.progressEndStream).thenReturn(progressEndStream);
      when(dependency.stopStream).thenReturn(stopStream);
      progressSync.synchronize(instance(dependency));

      /// When
      stopStream.next(IGNORE);
      Numbers.range(0, 1000).forEach(() => progressStartStream.next(true));
      Numbers.range(0, 1000).forEach(() => progressEndStream.next(false));

      setTimeout(() => {
        /// Then
        verify(progressReceiver.next(anything())).never();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Streaming progress flags - should emit flags in correct order',
    done => {
      /// Setup
      const fetchSync = new FetchSync(progressSync);
      const paramStream = new Subject<Try<number>>();
      const resultReceiver: NextObserver<number> = spy({ next: () => {} });
      const parameters: Try<number>[] = [
        Try.success(0),
        Try.failure<number>(''),
        Try.success(1)
      ];
      const paramStreamDelay = asyncWait / (parameters.length + 1);

      fetchSync.synchronize<number, number>({
        paramStream,
        allowDuplicateParams: false,
        allowInvalidResult: true,
        description: '',
        errorReceiver: { next: () => {} },
        progressReceiver: { ...instance(progressReceiver) },
        fetchWithParam: () => {
          if (Booleans.random()) {
            return of(0);
          }

          return throwError(new Error('Error!'));
        },
        resultReceiptScheduler: asapScheduler,
        resultReceiver: { ...instance(resultReceiver) },
        stopStream: NEVER
      });

      /// When
      zip(of(...parameters), timer(0, paramStreamDelay))
        .pipe(
          doOnNext(([param]) => paramStream.next(param)),
          doOnCompleted(() => {
            setTimeout(() => {
              [true, false, true, false, true, false].forEach((f, i) => {
                expect(
                  capture(progressReceiver.next).byCallIndex(i)[0]
                ).toEqual(f);
              });

              done();
            }, asyncWait);
          })
        )
        .subscribe();
    },
    asyncTimeout
  );
});
