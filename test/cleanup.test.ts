import { Depn as CleanUpDepn, Impl as CleanUpSync } from 'cleanup';
import { IGNORE, Ignore, Numbers, Try } from 'javascriptutilities';
import { NEVER, NextObserver, Subject } from 'rxjs';
import { anything, instance, spy, verify, when } from 'ts-mockito-2';

describe('Clean up sync should work correctly', () => {
  let dependency: CleanUpDepn;
  let synchronizer: CleanUpSync;
  let cleanUpReceiver: NextObserver<Ignore>;

  beforeEach(() => {
    cleanUpReceiver = spy({ next: () => { } });

    dependency = spy({
      cleanUpReceiver: { ...instance(cleanUpReceiver) },
      triggerStream: NEVER,
      stopStream: NEVER,
    });

    synchronizer = new CleanUpSync();
  });

  it('Sending clean up trigger result fails - should invoke cleanup', () => {
    /// Setup
    let triggerStream = new Subject<Ignore>();
    when(dependency.triggerStream).thenReturn(triggerStream);
    synchronizer.synchronize(instance(dependency));

    /// When
    triggerStream.next(IGNORE);

    /// Then
    verify(cleanUpReceiver.next(anything())).once();
  });

  it('Sending stop signal - should unsubscribe all streams', () => {
    /// Setup
    let triggerStream = new Subject<Ignore>();
    let stopStream = new Subject<Ignore>();
    when(dependency.triggerStream).thenReturn(triggerStream);
    when(dependency.stopStream).thenReturn(stopStream);
    synchronizer.synchronize(instance(dependency));

    /// When
    triggerStream.next(IGNORE);
    stopStream.next(IGNORE);
    Numbers.range(10, 1000).forEach((v => triggerStream.next(Try.success(v))));

    /// Then
    verify(cleanUpReceiver.next(anything())).once();
  });
});
