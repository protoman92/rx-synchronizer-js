import { Depn as FetchDepn, Impl as FetchSync } from 'fetch';
import { IGNORE, Ignore, Numbers, Try } from 'javascriptutilities';
import { doOnCompleted, doOnNext } from 'rx-utilities-js';
import { NEVER, NextObserver, of, queueScheduler, Subject, throwError, timer } from 'rxjs';
import { zip } from 'rxjs/operators';
import { anything, instance, spy, verify, when } from 'ts-mockito-2';

describe('Fetch sync should work correctly', () => {
  let dependency: FetchDepn<number, number>;
  let synchronizer: FetchSync;
  let errorReceiver: NextObserver<Error>;
  let progressReceiver: NextObserver<boolean>;
  let resultReceiver: NextObserver<number>;

  beforeEach(() => {
    errorReceiver = spy({ next: (_e: Error) => { } });
    progressReceiver = spy({ next: (_v: boolean) => { } });
    resultReceiver = spy({ next: (_v: number) => { } });

    dependency = spy({
      allowDuplicateParams: false,
      allowInvalidResult: false,
      description: '',
      errorReceiver: { ...instance(errorReceiver) },
      fetchWithParam: () => NEVER,
      paramStream: NEVER,
      progressReceiver: { ...instance(progressReceiver) },
      resultReceiver: { ...instance(resultReceiver) },
      resultReceiptScheduler: queueScheduler,
      stopStream: NEVER,
    });

    synchronizer = new FetchSync();
  });

  it('Fetching result fails - should notify error', () => {
    /// Setup
    let paramStream = new Subject<Try<number>>();
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.fetchWithParam(0)).thenReturn(of(0));
    when(dependency.fetchWithParam(1)).thenReturn(throwError(new Error('')));

    synchronizer.synchronize(instance(dependency));

    /// When
    of(
      Try.failure<number>(''),
      Try.success(0),
      Try.success(1),
    ).pipe(
      zip(timer(0, 100), (v1, _v2) => v1),
      doOnNext(v => paramStream.next(v)),
      doOnCompleted(() => {
        /// Then
        verify(errorReceiver.next(anything())).once();
        verify(resultReceiver.next(anything())).once();
      })
    ).subscribe();
  });

  it('Fetching result succeeds - should notify results receiver', () => {
    /// Setup
    let results = Numbers.randomBetween(0, 1000);
    let paramStream = new Subject<Try<number>>();
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.fetchWithParam(anything())).thenReturn(of(results));
    synchronizer.synchronize(instance(dependency));

    /// When
    paramStream.next(Try.success(0));

    /// Then
    verify(resultReceiver.next(results)).once();
  });

  it('Fetching responses with duplicate params - should notify receiver once', () => {
    /// Setup
    let paramStream = new Subject<Try<number>>();
    when(dependency.allowDuplicateParams).thenReturn(false);
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.fetchWithParam(anything())).thenReturn(of(0));
    synchronizer.synchronize(instance(dependency));

    /// When
    Numbers.range(0, 1000).forEach(() => paramStream.next(Try.success(0)));

    /// Then
    verify(resultReceiver.next(anything())).once();
  });

  it('Allowing duplicate params - should not filter out duplicate params', () => {
    /// Setup
    let paramStream = new Subject<Try<number>>();
    when(dependency.allowDuplicateParams).thenReturn(true);
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.fetchWithParam(anything())).thenReturn(of(0));
    synchronizer.synchronize(instance(dependency));

    /// When
    Numbers.range(0, 1000).forEach(() => paramStream.next(Try.success(0)));

    /// Then
    verify(resultReceiver.next(anything())).times(1000);
  });

  it('Allowing invalid result - should not filter out invalid results', () => {
    /// Setup
    let times = 1000;
    let paramStream = new Subject<Try<number>>();
    when(dependency.allowDuplicateParams).thenReturn(true);
    when(dependency.allowInvalidResult).thenReturn(true);
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.fetchWithParam(anything())).thenReturn(throwError(new Error('')));
    synchronizer.synchronize(instance(dependency));

    /// When
    Numbers.range(0, times).forEach(() => paramStream.next(Try.success(0)));

    /// Then
    verify(resultReceiver.next(anything())).times(times);
    verify(errorReceiver.next(anything())).times(times);
  });

  it('Sending stop signal - should unsubscribe all streams', () => {
    /// Setup
    let paramStream = new Subject<Try<number>>();
    let stopStream = new Subject<Ignore>();
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.stopStream).thenReturn(stopStream);
    when(dependency.fetchWithParam(anything())).thenReturn(of(0));
    synchronizer.synchronize(instance(dependency));

    /// When
    paramStream.next(Try.success(0));
    paramStream.next(Try.success(1));
    stopStream.next(IGNORE);
    Numbers.range(10, 1000).forEach((v => paramStream.next(Try.success(v))));

    /// Then
    verify(resultReceiver.next(anything())).twice();
  });

  it('Ignoring result receipt scheduler - should use a default scheduler', done => {
    /// Setup
    let paramStream = new Subject<Try<number>>();
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.fetchWithParam(anything())).thenReturn(of(0));
    when(dependency.resultReceiptScheduler).thenReturn(undefined);
    synchronizer.synchronize(instance(dependency));

    /// When
    paramStream.next(Try.success(0));

    /// Then
    setTimeout(() => { verify(resultReceiver.next(0)).once(); done(); }, 10);
  }, 100);
});
