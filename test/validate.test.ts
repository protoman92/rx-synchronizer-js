import {IGNORE, Ignore, Never, Numbers, Try} from 'javascriptutilities';
import {NEVER, NextObserver, Subject} from 'rxjs';
import {anything, capture, instance, spy, verify, when} from 'ts-mockito-2';
import {Depn as ValidateDepn, Impl as ValidateSync} from 'validate';

describe('Validate sync should work correctly', () => {
  let dependency: ValidateDepn<number>;
  let synchronizer: ValidateSync;
  let errorReceiver: NextObserver<Never<Error>>;

  beforeEach(() => {
    errorReceiver = spy({next: () => {}});

    dependency = spy({
      errorReceiver: {...instance(errorReceiver)},
      objectStream: NEVER,
      stopStream: NEVER,
      validateObject: () => {},
    });

    synchronizer = new ValidateSync();
  });

  it('Streaming duplicate params - should receive only unique params', () => {
    /// Setup
    let objectStream = new Subject<Try<number>>();
    when(dependency.objectStream).thenReturn(objectStream);
    synchronizer.synchronize(instance(dependency));

    /// When
    Numbers.range(0, 1000).forEach(() => objectStream.next(Try.success(0)));

    /// Then
    verify(dependency.validateObject(anything())).once();
  });

  it('Validating fails - should broadcast error', () => {
    /// Setup
    let error = 'Error!!!';
    let objectStream = new Subject<Try<number>>();
    when(dependency.objectStream).thenReturn(objectStream);
    when(dependency.validateObject(anything())).thenCall(() => {
      throw new Error(error);
    });

    synchronizer.synchronize(instance(dependency));

    /// When
    objectStream.next(Try.success(0));

    /// Then
    verify(dependency.validateObject(anything())).once();
    expect(capture(errorReceiver.next).first()[0]!.message).toEqual(error);
  });

  it('Validating fails with same error - should only broadcast uniques', () => {
    /// Setup
    let times = 1000;
    let error = 'Error!!!';
    let objectStream = new Subject<Try<number>>();
    when(dependency.objectStream).thenReturn(objectStream);
    when(dependency.validateObject(anything())).thenCall(() => {
      throw new Error(error);
    });

    synchronizer.synchronize(instance(dependency));

    /// When
    Numbers.range(0, times).forEach(v => objectStream.next(Try.success(v)));

    /// Then
    verify(dependency.validateObject(anything())).times(times);
    verify(errorReceiver.next(anything())).once();
    expect(capture(errorReceiver.next).first()[0]!.message).toEqual(error);
  });

  it('Validating succeeds - should only broadcast uniques', () => {
    /// Setup
    let times = 1000;
    let objectStream = new Subject<Try<number>>();
    when(dependency.objectStream).thenReturn(objectStream);
    when(dependency.validateObject(anything())).thenCall(() => {});
    synchronizer.synchronize(instance(dependency));

    /// When
    Numbers.range(0, times).forEach(v => objectStream.next(Try.success(v)));

    /// Then
    verify(dependency.validateObject(anything())).times(times);
    verify(errorReceiver.next(undefined)).once();
  });

  it('Sending stop signal - should unsubscribe all streams', () => {
    /// Setup
    let objectStream = new Subject<Try<number>>();
    let stopStream = new Subject<Ignore>();
    when(dependency.objectStream).thenReturn(objectStream);
    when(dependency.stopStream).thenReturn(stopStream);
    synchronizer.synchronize(instance(dependency));

    /// When
    objectStream.next(Try.success(0));
    stopStream.next(IGNORE);
    Numbers.range(0, 1000).forEach(v => objectStream.next(Try.success(v)));

    /// Then
    verify(errorReceiver.next(anything())).once();
  });
});
