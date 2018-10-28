import {IGNORE, Ignore, Numbers, Try} from 'javascriptutilities';
import {NEVER, NextObserver, Subject} from 'rxjs';
import {Depn as TriggerDepn, Impl as TriggerSync} from 'trigger';
import {anything, instance, spy, verify, when} from 'ts-mockito-2';
import {asyncWait, asyncTimeout} from './test-util';

describe('Trigger sync should work correctly', () => {
  let dependency: TriggerDepn;
  let synchronizer: TriggerSync;
  let triggerReceiver: NextObserver<Ignore>;

  beforeEach(() => {
    triggerReceiver = spy({next: () => {}});

    dependency = spy<TriggerDepn>({
      triggerReceiver: {...instance(triggerReceiver)},
      triggerStream: NEVER,
      stopStream: NEVER,
    });

    synchronizer = new TriggerSync();
  });

  it(
    'Sending trigger - should invoke trigger receiver',
    done => {
      /// Setup
      const triggerStream = new Subject<Ignore>();
      when(dependency.triggerStream).thenReturn(triggerStream);
      synchronizer.synchronize(instance(dependency));

      /// When
      triggerStream.next(IGNORE);

      setTimeout(() => {
        /// Then
        verify(triggerReceiver.next(anything())).once();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Sending stop signal - should unsubscribe all streams',
    done => {
      /// Setup
      const triggerStream = new Subject<Ignore>();
      const stopStream = new Subject<Ignore>();
      when(dependency.triggerStream).thenReturn(triggerStream);
      when(dependency.stopStream).thenReturn(stopStream);
      synchronizer.synchronize(instance(dependency));

      /// When
      triggerStream.next(IGNORE);
      stopStream.next(IGNORE);
      Numbers.range(10, 1000).forEach(v => triggerStream.next(Try.success(v)));

      setTimeout(() => {
        /// Then
        verify(triggerReceiver.next(anything())).once();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );
});
