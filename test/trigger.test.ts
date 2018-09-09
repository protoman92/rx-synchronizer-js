import {IGNORE, Ignore, Numbers, Try} from 'javascriptutilities';
import {NEVER, NextObserver, Subject} from 'rxjs';
import {Depn as TriggerDepn, Impl as TriggerSync} from 'trigger';
import {anything, instance, spy, verify, when} from 'ts-mockito-2';

describe('Trigger sync should work correctly', () => {
  let dependency: TriggerDepn;
  let synchronizer: TriggerSync;
  let triggerReceiver: NextObserver<Ignore>;

  beforeEach(() => {
    triggerReceiver = spy({next: () => {}});

    dependency = spy({
      triggerReceiver: {...instance(triggerReceiver)},
      triggerStream: NEVER,
      stopStream: NEVER,
    });

    synchronizer = new TriggerSync();
  });

  it('Sending trigger - should invoke trigger receiver', () => {
    /// Setup
    let triggerStream = new Subject<Ignore>();
    when(dependency.triggerStream).thenReturn(triggerStream);
    synchronizer.synchronize(instance(dependency));

    /// When
    triggerStream.next(IGNORE);

    /// Then
    verify(triggerReceiver.next(anything())).once();
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
    Numbers.range(10, 1000).forEach(v => triggerStream.next(Try.success(v)));

    /// Then
    verify(triggerReceiver.next(anything())).once();
  });
});
