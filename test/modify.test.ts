import {Numbers, Strings, Try} from 'javascriptutilities';
import {Depn as ModifyDepn, Impl as ModifySync} from 'modify';
import {
  NEVER,
  NextObserver,
  of,
  queueScheduler,
  Subject,
  throwError,
} from 'rxjs';
import {anything, capture, instance, spy, verify, when} from 'ts-mockito-2';
import {Type as ProgressSync} from 'progress';

describe('Modify sync should work correctly', () => {
  let dependency: ModifyDepn<number, number>;
  let progressSync: ProgressSync;
  let synchronizer: ModifySync;
  let errorReceiver: NextObserver<Error>;
  let progressReceiver: NextObserver<boolean>;
  let resultReceiver: NextObserver<number>;

  beforeEach(() => {
    errorReceiver = spy({next: (_e: Error) => {}});
    progressReceiver = spy({next: (_v: boolean) => {}});
    resultReceiver = spy({next: (_v: number) => {}});

    dependency = spy<ModifyDepn<number, number>>({
      allowDuplicateParams: false,
      description: '',
      errorReceiver: {...instance(errorReceiver)},
      modifyWithParam: () => NEVER,
      paramStream: NEVER,
      progressReceiver: {...instance(progressReceiver)},
      resultReceiver: {...instance(resultReceiver)},
      resultReceiptScheduler: queueScheduler,
      stopStream: NEVER,
      validateParam: () => [],
    });

    progressSync = spy({synchronize: () => {}});
    synchronizer = new ModifySync(instance(progressSync));
  });

  it('Streaming invalid params - should catch error', () => {
    /// Setup
    let paramStream = new Subject<Try<number>>();
    when(dependency.paramStream).thenReturn(paramStream);
    synchronizer.synchronize(instance(dependency));
    let progressDepn = capture(progressSync.synchronize).first()[0];
    progressDepn.progressStartStream.subscribe({...instance(progressReceiver)});
    progressDepn.progressEndStream.subscribe({...instance(progressReceiver)});

    /// When
    paramStream.next(Try.failure('Error'));

    /// Then
    expect(capture(errorReceiver.next).first()[0].message).toEqual('Error');
    verify(progressReceiver.next(true)).once();
    verify(progressReceiver.next(false)).once();
    verify(resultReceiver.next(anything())).never();
  });

  it('Validating with failure stream - should catch error', () => {
    /// Setup
    let error = new Error('error');
    let paramStream = new Subject<Try<number>>();
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.validateParam(anything())).thenReturn(throwError(error));
    synchronizer.synchronize(instance(dependency));
    let progressDepn = capture(progressSync.synchronize).first()[0];
    progressDepn.progressStartStream.subscribe({...instance(progressReceiver)});
    progressDepn.progressEndStream.subscribe({...instance(progressReceiver)});

    /// When
    paramStream.next(Try.success(0));

    /// Then
    expect(capture(errorReceiver.next).first()[0].message).toEqual(
      error.message
    );
    verify(progressReceiver.next(true)).once();
    verify(progressReceiver.next(false)).once();
    verify(resultReceiver.next(anything())).never();
  });

  it('Validating fails - should catch error', () => {
    /// Setup
    let times = 1000;
    let errors = Numbers.range(0, times).map(
      () => new Error(Strings.randomString(10))
    );
    let paramStream = new Subject<Try<number>>();
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.validateParam(anything())).thenReturn(errors);
    synchronizer.synchronize(instance(dependency));
    let progressDepn = capture(progressSync.synchronize).first()[0];
    progressDepn.progressStartStream.subscribe({...instance(progressReceiver)});
    progressDepn.progressEndStream.subscribe({...instance(progressReceiver)});

    /// When
    paramStream.next(Try.success(0));

    /// Then
    for (let i = 0; i < times; i++) {
      let errMessage = capture(errorReceiver.next).byCallIndex(i)[0].message;
      expect(errMessage).toEqual(errors[i].message);
    }

    verify(progressReceiver.next(true)).once();
    verify(progressReceiver.next(false)).once();
    verify(resultReceiver.next(anything())).never();
  });

  it('Modifying fails - should catch error', () => {
    /// Setup
    let error = new Error('Error');
    let paramStream = new Subject<Try<number>>();
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.validateParam(anything())).thenReturn([]);
    when(dependency.modifyWithParam(anything())).thenReturn(throwError(error));
    synchronizer.synchronize(instance(dependency));
    let progressDepn = capture(progressSync.synchronize).first()[0];
    progressDepn.progressStartStream.subscribe({...instance(progressReceiver)});
    progressDepn.progressEndStream.subscribe({...instance(progressReceiver)});

    /// When
    paramStream.next(Try.success(0));

    /// Then
    expect(capture(errorReceiver.next).first()[0].message).toEqual(
      error.message
    );
    verify(progressReceiver.next(true)).once();
    verify(progressReceiver.next(false)).once();
    verify(resultReceiver.next(anything())).never();
  });

  it('Modifying successfully - should trigger result receiver', () => {
    /// Setup
    let result = 0;
    let paramStream = new Subject<Try<number>>();
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.validateParam(anything())).thenReturn([]);
    when(dependency.modifyWithParam(anything())).thenReturn(of(result));
    synchronizer.synchronize(instance(dependency));
    let progressDepn = capture(progressSync.synchronize).first()[0];
    progressDepn.progressStartStream.subscribe({...instance(progressReceiver)});
    progressDepn.progressEndStream.subscribe({...instance(progressReceiver)});

    /// When
    paramStream.next(Try.success(0));

    /// Then
    verify(errorReceiver.next(anything())).never();
    verify(progressReceiver.next(true)).once();
    verify(progressReceiver.next(false)).once();
    verify(resultReceiver.next(result)).once();
  });

  it(
    'Failing to provide result scheduler - should use default scheduler',
    done => {
      /// Setup
      let result = 0;
      let paramStream = new Subject<Try<number>>();
      when(dependency.paramStream).thenReturn(paramStream);
      when(dependency.resultReceiptScheduler).thenReturn(undefined);
      when(dependency.validateParam(anything())).thenReturn([]);
      when(dependency.modifyWithParam(anything())).thenReturn(of(result));
      synchronizer.synchronize(instance(dependency));
      let progressDepn = capture(progressSync.synchronize).first()[0];
      progressDepn.progressStartStream.subscribe({
        ...instance(progressReceiver),
      });
      progressDepn.progressEndStream.subscribe({...instance(progressReceiver)});

      /// When
      paramStream.next(Try.success(0));

      /// Then
      setTimeout(() => {
        verify(errorReceiver.next(anything())).never();
        verify(progressReceiver.next(true)).once();
        verify(progressReceiver.next(false)).once();
        verify(resultReceiver.next(result)).once();
        done();
      }, 10);
    },
    100
  );

  it('Streaming duplicate params - should only receive unique params', () => {
    /// Setup
    let times = 1000;
    let paramStream = new Subject<Try<number>>();
    when(dependency.allowDuplicateParams).thenReturn(false);
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.modifyWithParam(anything())).thenReturn(of(0));
    synchronizer.synchronize(instance(dependency));

    /// When
    Numbers.range(0, times).forEach(() => paramStream.next(Try.success(0)));

    /// Then
    verify(resultReceiver.next(anything())).times(1);
  });

  it('Allowing duplicate params - should not filter out duplicate params', () => {
    /// Setup
    let times = 1000;
    let paramStream = new Subject<Try<number>>();
    when(dependency.allowDuplicateParams).thenReturn(true);
    when(dependency.paramStream).thenReturn(paramStream);
    when(dependency.modifyWithParam(anything())).thenReturn(of(0));

    synchronizer.synchronize(instance(dependency));

    /// When
    Numbers.range(0, times).forEach(() => paramStream.next(Try.success(0)));

    /// Then
    verify(resultReceiver.next(anything())).times(times);
  });
});
