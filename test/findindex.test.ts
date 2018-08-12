import { Depn as FindIndexDepn, Impl as FindIndexSync } from 'findindex';
import { Nullable, Try } from 'javascriptutilities';
import { NEVER, NextObserver, Subject } from 'rxjs';
import { Depn as TriggerDepn, Impl as TriggerSync } from 'trigger';
import { anything, capture, instance, mock, spy, verify, when } from 'ts-mockito-2';

describe('Find index synchronizer should work correctly', () => {
  type Indexed = { readonly id?: string };
  let triggerSync: TriggerSync;
  let findIndexSync: FindIndexSync;
  let dependency: FindIndexDepn<Indexed>;
  let indexReceiver: NextObserver<Nullable<number>>;

  beforeEach(() => {
    indexReceiver = spy({ next: () => { } });

    dependency = spy({
      allowInvalidResult: false,
      allObjectStream: NEVER,
      objectPropKey: 'id' as keyof Indexed,
      objectPropStream: NEVER,
      objectIndexReceiver: { ...instance(indexReceiver) },
      stopStream: NEVER,
    });

    triggerSync = mock(TriggerSync);
    findIndexSync = new FindIndexSync(instance(triggerSync));
  });

  it('Invoking synchronization - should map dependency to base dependency', () => {
    /// Setup
    let objectStream = new Subject<Try<Indexed[]>>();
    let objectPropStream = new Subject<Try<string>>();
    when(dependency.allowInvalidResult).thenReturn(true);
    when(dependency.allObjectStream).thenReturn(objectStream);
    when(dependency.objectPropStream).thenReturn(objectPropStream);
    findIndexSync.synchronize(instance(dependency));
    let mappedDepn = capture(triggerSync.synchronize).first()[0] as TriggerDepn<Nullable<number>>;
    mappedDepn.triggerStream.subscribe({ ...instance(indexReceiver) });

    /// When
    objectStream.next(Try.failure(''));
    objectPropStream.next(Try.failure(''));
    objectStream.next(Try.success([{}, {}, { id: '1' }]));
    objectPropStream.next(Try.failure(''));
    objectPropStream.next(Try.success('1'));
    objectStream.next(Try.success([{}, {}, {}]));
    verify(indexReceiver.next(undefined)).twice();
    verify(indexReceiver.next(2)).once();
    verify(indexReceiver.next(anything())).thrice();
  });

  it('Disallowing invalid results - should filter out invalid results', () => {
    /// Setup
    let objectStream = new Subject<Try<Indexed[]>>();
    let objectPropStream = new Subject<Try<string>>();
    when(dependency.allowInvalidResult).thenReturn(false);
    when(dependency.allObjectStream).thenReturn(objectStream);
    when(dependency.objectPropStream).thenReturn(objectPropStream);
    findIndexSync.synchronize(instance(dependency));
    let mappedDepn = capture(triggerSync.synchronize).first()[0] as TriggerDepn<Nullable<number>>;
    mappedDepn.triggerStream.subscribe({ ...instance(indexReceiver) });

    /// When
    objectStream.next(Try.failure(''));
    objectPropStream.next(Try.failure(''));
    objectStream.next(Try.success([{}, {}, { id: '1' }]));
    objectPropStream.next(Try.failure(''));
    objectPropStream.next(Try.success('1'));
    objectStream.next(Try.success([{}, {}, {}]));
    verify(indexReceiver.next(2)).once();
    verify(indexReceiver.next(anything())).once();
  });
});
