import { Depn as FetchDepn, Impl as FetchSync } from 'fetch';
import { IGNORE, Ignore, Nullable, Numbers, Try } from 'javascriptutilities';
import { Type as ProgressSync } from 'progress';
import { NEVER, NextObserver, of, queueScheduler, Subject, throwError } from 'rxjs';
import { anyOfClass, anything, instance, spy, verify, when, capture } from 'ts-mockito-2';

describe('Fetch sync should work correctly', () => {
  let dependency: FetchDepn<number, number>;
  let progressSync: ProgressSync;
  let synchronizer: FetchSync;
  let errorReceiver: NextObserver<Nullable<Error>>;
  let progressReceiver: NextObserver<boolean>;
  let resultReceiver: NextObserver<Nullable<number>>;

  beforeEach(() => {
    errorReceiver = spy({ next: () => { } });
    progressReceiver = spy({ next: () => { } });
    resultReceiver = spy({ next: () => { } });

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

    progressSync = spy({ synchronize: () => { } });
    synchronizer = new FetchSync(instance(progressSync));
  });

  it('Fetching result fails - should notify error', () => {
    /// Setup
    let paramStream = new Subject<Try<number>>();
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.fetchWithParam(0)).thenReturn(of(0));
    when(dependency.fetchWithParam(1)).thenReturn(throwError(new Error('')));
    synchronizer.synchronize(instance(dependency));
    let progressDepn = capture(progressSync.synchronize).first()[0];
    progressDepn.progressStartStream.subscribe({ ...instance(progressReceiver) });
    progressDepn.progressEndStream.subscribe({ ...instance(progressReceiver) });

    /// When
    paramStream.next(Try.success(0));
    paramStream.next(Try.success(1));
    paramStream.next(Try.failure('Invalid param'));

    /// Then
    verify(errorReceiver.next(undefined)).once();
    verify(errorReceiver.next(anyOfClass(Error))).twice();
    verify(resultReceiver.next(anything())).once();
    verify(progressReceiver.next(true)).times(3);
    verify(progressReceiver.next(false)).times(3);
  });

  it('Fetching result succeeds - should notify results receiver', () => {
    /// Setup
    let results = Numbers.randomBetween(0, 1000);
    let paramStream = new Subject<Try<number>>();
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.fetchWithParam(anything())).thenReturn(of(results));
    synchronizer.synchronize(instance(dependency));
    let progressDepn = capture(progressSync.synchronize).first()[0];
    progressDepn.progressStartStream.subscribe({ ...instance(progressReceiver) });
    progressDepn.progressEndStream.subscribe({ ...instance(progressReceiver) });

    /// When
    paramStream.next(Try.success(0));

    /// Then
    verify(resultReceiver.next(results)).once();
    verify(progressReceiver.next(true)).once();
    verify(progressReceiver.next(false)).once();
  });

  it('Fetching responses with duplicate params - should notify receiver once', () => {
    /// Setup
    let paramStream = new Subject<Try<number>>();
    when(dependency.allowDuplicateParams).thenReturn(false);
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.fetchWithParam(anything())).thenReturn(of(0));
    synchronizer.synchronize(instance(dependency));
    let progressDepn = capture(progressSync.synchronize).first()[0];
    progressDepn.progressStartStream.subscribe({ ...instance(progressReceiver) });
    progressDepn.progressEndStream.subscribe({ ...instance(progressReceiver) });

    /// When
    Numbers.range(0, 1000).forEach(() => paramStream.next(Try.success(0)));

    /// Then
    verify(resultReceiver.next(anything())).once();
    verify(progressReceiver.next(true)).once();
    verify(progressReceiver.next(false)).once();
  });

  it('Allowing duplicate params - should not filter out duplicate params', () => {
    /// Setup
    let times = 1000;
    let paramStream = new Subject<Try<number>>();
    when(dependency.allowDuplicateParams).thenReturn(true);
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.fetchWithParam(anything())).thenReturn(of(0));
    synchronizer.synchronize(instance(dependency));
    let progressDepn = capture(progressSync.synchronize).first()[0];
    progressDepn.progressStartStream.subscribe({ ...instance(progressReceiver) });
    progressDepn.progressEndStream.subscribe({ ...instance(progressReceiver) });

    /// When
    Numbers.range(0, times).forEach(() => paramStream.next(Try.success(0)));

    /// Then
    verify(resultReceiver.next(anything())).times(times);
    verify(progressReceiver.next(true)).times(times);
    verify(progressReceiver.next(false)).times(times);
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
    let progressDepn = capture(progressSync.synchronize).first()[0];
    progressDepn.progressStartStream.subscribe({ ...instance(progressReceiver) });
    progressDepn.progressEndStream.subscribe({ ...instance(progressReceiver) });

    /// When
    Numbers.range(0, times).forEach(() => paramStream.next(Try.success(0)));

    /// Then
    verify(resultReceiver.next(anything())).times(times);
    verify(errorReceiver.next(anything())).times(times);
    verify(progressReceiver.next(true)).times(times);
    verify(progressReceiver.next(false)).times(times);
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
