import { Depn as FetchDepn, Impl as FetchSync } from 'fetch';
import { IGNORE, Ignore, Never, Numbers, Try } from 'javascriptutilities';
import { Type as ProgressSync } from 'progress';
import {
  NEVER,
  NextObserver,
  of,
  queueScheduler,
  Subject,
  throwError
} from 'rxjs';
import {
  anyOfClass,
  anything,
  capture,
  instance,
  spy,
  verify,
  when
} from 'ts-mockito-2';
import { asyncTimeout, asyncWait } from './test-util';

describe('Fetch sync should work correctly', () => {
  let dependency: FetchDepn<number, number>;
  let progressSync: ProgressSync;
  let synchronizer: FetchSync;
  let errorReceiver: NextObserver<Never<Error>>;
  let progressReceiver: NextObserver<boolean>;
  let resultReceiver: NextObserver<Never<number>>;

  beforeEach(() => {
    errorReceiver = spy({ next: () => {} });
    progressReceiver = spy({ next: () => {} });
    resultReceiver = spy({ next: () => {} });

    dependency = spy<FetchDepn<number, number>>({
      allowDuplicateParams: false,
      allowInvalidResult: false,
      description: '',
      errorReceiver: { ...instance(errorReceiver) },
      fetchWithParam: () => NEVER,
      paramStream: NEVER,
      progressReceiver: { ...instance(progressReceiver) },
      resultReceiver: { ...instance(resultReceiver) },
      resultReceiptScheduler: queueScheduler,
      stopStream: NEVER
    });

    progressSync = spy({ synchronize: () => {} });
    synchronizer = new FetchSync(instance(progressSync));
  });

  it(
    'Fetching result fails - should notify error',
    done => {
      /// Setup
      const paramStream = new Subject<Try<number>>();
      when(dependency.paramStream).thenReturn(paramStream);
      when(dependency.fetchWithParam(0)).thenReturn(of(0));
      when(dependency.fetchWithParam(1)).thenReturn(throwError(new Error('')));
      synchronizer.synchronize(instance(dependency));
      const progressDepn = capture(progressSync.synchronize).first()[0];
      progressDepn.progressStartStream.subscribe({
        ...instance(progressReceiver)
      });
      progressDepn.progressEndStream.subscribe({
        ...instance(progressReceiver)
      });

      /// When
      paramStream.next(Try.success(0));
      paramStream.next(Try.success(1));
      paramStream.next(Try.failure('Invalid param'));

      setTimeout(() => {
        /// Then
        verify(errorReceiver.next(undefined)).once();
        verify(errorReceiver.next(anyOfClass(Error))).twice();
        verify(resultReceiver.next(anything())).once();
        verify(progressReceiver.next(true)).times(3);
        verify(progressReceiver.next(false)).times(3);
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Fetching result succeeds - should notify results receiver',
    done => {
      /// Setup
      const results = Numbers.randomBetween(0, 1000);
      const paramStream = new Subject<Try<number>>();
      when(dependency.paramStream).thenReturn(paramStream);
      when(dependency.fetchWithParam(anything())).thenReturn(of(results));
      synchronizer.synchronize(instance(dependency));
      const progressDepn = capture(progressSync.synchronize).first()[0];
      progressDepn.progressStartStream.subscribe({
        ...instance(progressReceiver)
      });
      progressDepn.progressEndStream.subscribe({
        ...instance(progressReceiver)
      });

      /// When
      paramStream.next(Try.success(0));

      setTimeout(() => {
        /// Then
        verify(resultReceiver.next(results)).once();
        verify(progressReceiver.next(true)).once();
        verify(progressReceiver.next(false)).once();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Fetching responses with duplicate params - should notify receiver once',
    done => {
      /// Setup
      const paramStream = new Subject<Try<number>>();
      when(dependency.allowDuplicateParams).thenReturn(false);
      when(dependency.paramStream).thenReturn(paramStream);
      when(dependency.fetchWithParam(anything())).thenReturn(of(0));
      synchronizer.synchronize(instance(dependency));
      const progressDepn = capture(progressSync.synchronize).first()[0];
      progressDepn.progressStartStream.subscribe({
        ...instance(progressReceiver)
      });
      progressDepn.progressEndStream.subscribe({
        ...instance(progressReceiver)
      });

      /// When
      Numbers.range(0, 1000).forEach(() => paramStream.next(Try.success(0)));

      setTimeout(() => {
        /// Then
        verify(resultReceiver.next(anything())).once();
        verify(progressReceiver.next(true)).once();
        verify(progressReceiver.next(false)).once();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Allowing duplicate params - should not filter out duplicate params',
    done => {
      /// Setup
      const times = 1000;
      const paramStream = new Subject<Try<number>>();
      when(dependency.allowDuplicateParams).thenReturn(true);
      when(dependency.paramStream).thenReturn(paramStream);
      when(dependency.fetchWithParam(anything())).thenReturn(of(0));
      synchronizer.synchronize(instance(dependency));
      const progressDepn = capture(progressSync.synchronize).first()[0];
      progressDepn.progressStartStream.subscribe({
        ...instance(progressReceiver)
      });
      progressDepn.progressEndStream.subscribe({
        ...instance(progressReceiver)
      });

      /// When
      Numbers.range(0, times).forEach(() => paramStream.next(Try.success(0)));

      setTimeout(() => {
        /// Then
        verify(resultReceiver.next(anything())).times(times);
        verify(progressReceiver.next(true)).times(times);
        verify(progressReceiver.next(false)).times(times);
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Allowing invalid result - should not filter out invalid results',
    done => {
      /// Setup
      const times = 1000;
      const paramStream = new Subject<Try<number>>();
      when(dependency.allowDuplicateParams).thenReturn(true);
      when(dependency.allowInvalidResult).thenReturn(true);
      when(dependency.paramStream).thenReturn(paramStream);
      when(dependency.fetchWithParam(anything())).thenReturn(
        throwError(new Error(''))
      );
      synchronizer.synchronize(instance(dependency));
      const progressDepn = capture(progressSync.synchronize).first()[0];
      progressDepn.progressStartStream.subscribe({
        ...instance(progressReceiver)
      });
      progressDepn.progressEndStream.subscribe({
        ...instance(progressReceiver)
      });

      /// When
      Numbers.range(0, times).forEach(() => paramStream.next(Try.success(0)));

      setTimeout(() => {
        /// Then
        verify(resultReceiver.next(anything())).times(times);
        verify(errorReceiver.next(anything())).times(times);
        verify(progressReceiver.next(true)).times(times);
        verify(progressReceiver.next(false)).times(times);
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Sending stop signal - should unsubscribe all streams',
    done => {
      /// Setup
      const paramStream = new Subject<Try<number>>();
      const stopStream = new Subject<Ignore>();
      when(dependency.paramStream).thenReturn(paramStream);
      when(dependency.stopStream).thenReturn(stopStream);
      when(dependency.fetchWithParam(anything())).thenReturn(of(0));
      synchronizer.synchronize(instance(dependency));

      /// When
      paramStream.next(Try.success(0));
      paramStream.next(Try.success(1));
      stopStream.next(IGNORE);
      Numbers.range(10, 1000).forEach(v => paramStream.next(Try.success(v)));

      /// Then
      setTimeout(() => {
        verify(resultReceiver.next(anything())).twice();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Ignoring result receipt scheduler - should use a default scheduler',
    done => {
      /// Setup
      const paramStream = new Subject<Try<number>>();
      when(dependency.paramStream).thenReturn(paramStream);
      when(dependency.fetchWithParam(anything())).thenReturn(of(0));
      when(dependency.resultReceiptScheduler).thenReturn(undefined);
      synchronizer.synchronize(instance(dependency));

      /// When
      paramStream.next(Try.success(0));

      /// Then
      setTimeout(() => {
        verify(resultReceiver.next(0)).once();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it('Constructing synchronizer with default arguments - should work', () => {
    const synchronizer2 = new FetchSync();
    synchronizer2.synchronize(instance(dependency));
  });
});
