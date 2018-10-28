import { Numbers, Strings, Try } from 'javascriptutilities';
import { Depn as ModifyDepn, Impl as ModifySync } from 'modify';
import { Type as ProgressSync } from 'progress';
import {
  NEVER,
  NextObserver,
  of,
  queueScheduler,
  Subject,
  throwError
} from 'rxjs';
import { anything, capture, instance, spy, verify, when } from 'ts-mockito-2';
import { asyncTimeout, asyncWait } from './test-util';

describe('Modify sync should work correctly', () => {
  let dependency: ModifyDepn<number, number>;
  let progressSync: ProgressSync;
  let synchronizer: ModifySync;
  let errorReceiver: NextObserver<Error>;
  let progressReceiver: NextObserver<boolean>;
  let resultReceiver: NextObserver<number>;

  beforeEach(() => {
    errorReceiver = spy({ next: () => {} });
    progressReceiver = spy({ next: () => {} });
    resultReceiver = spy({ next: () => {} });

    dependency = spy<ModifyDepn<number, number>>({
      allowDuplicateParams: false,
      description: '',
      errorReceiver: { ...instance(errorReceiver) },
      modifyWithParam: () => NEVER,
      paramStream: NEVER,
      progressReceiver: { ...instance(progressReceiver) },
      resultReceiver: { ...instance(resultReceiver) },
      resultReceiptScheduler: queueScheduler,
      stopStream: NEVER,
      validateParam: () => []
    });

    progressSync = spy({ synchronize: () => {} });
    synchronizer = new ModifySync(instance(progressSync));
  });

  it(
    'Streaming invalid params - should catch error',
    done => {
      /// Setup
      const paramStream = new Subject<Try<number>>();
      when(dependency.paramStream).thenReturn(paramStream);
      synchronizer.synchronize(instance(dependency));
      const progressDepn = capture(progressSync.synchronize).first()[0];
      progressDepn.progressStartStream.subscribe({
        ...instance(progressReceiver)
      });
      progressDepn.progressEndStream.subscribe({
        ...instance(progressReceiver)
      });

      /// When
      paramStream.next(Try.failure('Error'));

      setTimeout(() => {
        /// Then
        expect(capture(errorReceiver.next).first()[0].message).toEqual('Error');
        verify(progressReceiver.next(true)).once();
        verify(progressReceiver.next(false)).once();
        verify(resultReceiver.next(anything())).never();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Validating with failure stream - should catch error',
    done => {
      /// Setup
      const error = new Error('error');
      const paramStream = new Subject<Try<number>>();
      when(dependency.paramStream).thenReturn(paramStream);
      when(dependency.validateParam(0)).thenReturn(throwError(error));
      when(dependency.validateParam(1)).thenReturn(of([error, error]));
      when(dependency.validateParam(2)).thenReturn([error, error]);
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
      paramStream.next(Try.success(2));

      setTimeout(() => {
        /// Then
        verify(errorReceiver.next(anything())).times(5);
        verify(progressReceiver.next(true)).times(3);
        verify(progressReceiver.next(false)).times(3);
        verify(resultReceiver.next(anything())).never();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Validating fails - should catch error',
    done => {
      /// Setup
      const times = 1000;
      const errors = Numbers.range(0, times).map(
        () => new Error(Strings.randomString(10))
      );
      const paramStream = new Subject<Try<number>>();
      when(dependency.paramStream).thenReturn(paramStream);
      when(dependency.validateParam(anything())).thenReturn(errors);
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
        for (let i = 0; i < times; i += 1) {
          const errMessage = capture(errorReceiver.next).byCallIndex(i)[0]
            .message;
          expect(errMessage).toEqual(errors[i].message);
        }

        verify(progressReceiver.next(true)).once();
        verify(progressReceiver.next(false)).once();
        verify(resultReceiver.next(anything())).never();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Modifying fails - should catch error',
    done => {
      /// Setup
      const error = new Error('Error');
      const paramStream = new Subject<Try<number>>();
      when(dependency.paramStream).thenReturn(paramStream);
      when(dependency.validateParam(anything())).thenReturn([]);
      when(dependency.modifyWithParam(anything())).thenReturn(
        throwError(error)
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
      paramStream.next(Try.success(0));

      setTimeout(() => {
        /// Then
        expect(capture(errorReceiver.next).first()[0].message).toEqual(
          error.message
        );
        verify(progressReceiver.next(true)).once();
        verify(progressReceiver.next(false)).once();
        verify(resultReceiver.next(anything())).never();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Modifying successfully - should trigger result receiver',
    done => {
      /// Setup
      const result = 0;
      const paramStream = new Subject<Try<number>>();
      when(dependency.paramStream).thenReturn(paramStream);
      when(dependency.validateParam(anything())).thenReturn([]);
      when(dependency.modifyWithParam(anything())).thenReturn(of(result));
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
        verify(errorReceiver.next(anything())).never();
        verify(progressReceiver.next(true)).once();
        verify(progressReceiver.next(false)).once();
        verify(resultReceiver.next(result)).once();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Failing to provide result scheduler - should use default scheduler',
    done => {
      /// Setup
      const result = 0;
      const paramStream = new Subject<Try<number>>();
      when(dependency.paramStream).thenReturn(paramStream);
      when(dependency.resultReceiptScheduler).thenReturn(undefined);
      when(dependency.validateParam(anything())).thenReturn([]);
      when(dependency.modifyWithParam(anything())).thenReturn(of(result));
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

      /// Then
      setTimeout(() => {
        verify(errorReceiver.next(anything())).never();
        verify(progressReceiver.next(true)).once();
        verify(progressReceiver.next(false)).once();
        verify(resultReceiver.next(result)).once();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Streaming duplicate params - should only receive unique params',
    done => {
      /// Setup
      const times = 1000;
      const paramStream = new Subject<Try<number>>();
      when(dependency.allowDuplicateParams).thenReturn(false);
      when(dependency.paramStream).thenReturn(paramStream);
      when(dependency.modifyWithParam(anything())).thenReturn(of(0));
      synchronizer.synchronize(instance(dependency));

      /// When
      Numbers.range(0, times).forEach(() => paramStream.next(Try.success(0)));

      setTimeout(() => {
        /// Then
        verify(resultReceiver.next(anything())).times(1);
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
      when(dependency.modifyWithParam(anything())).thenReturn(of(0));

      synchronizer.synchronize(instance(dependency));

      /// When
      Numbers.range(0, times).forEach(() => paramStream.next(Try.success(0)));

      setTimeout(() => {
        /// Then
        verify(resultReceiver.next(anything())).times(times);
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it('Constructing synchronizer with default arguments - should work', () => {
    const synchronizer2 = new ModifySync();
    synchronizer2.synchronize(instance(dependency));
  });
});
