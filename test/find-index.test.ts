import { Depn as FindIndexDepn, Impl as FindIndexSync } from 'find-index';
import { Never, Try } from 'javascriptutilities';
import { NEVER, NextObserver, Subject } from 'rxjs';
import { Depn as TriggerDepn, Impl as TriggerSync } from 'trigger';
import {
  anything,
  capture,
  instance,
  mock,
  spy,
  verify,
  when
} from 'ts-mockito-2';
import { asyncTimeout, asyncWait } from './test-util';

describe('Find index synchronizer should work correctly', () => {
  type Indexed = { readonly id?: string; readonly name?: string };
  let triggerSync: TriggerSync;
  let findIndexSync: FindIndexSync;
  let dependency: FindIndexDepn<Indexed>;
  let indexReceiver: NextObserver<Never<number>>;

  beforeEach(() => {
    indexReceiver = spy({ next: () => {} });

    dependency = spy<FindIndexDepn<Indexed>>({
      allowInvalidResult: false,
      allObjectStream: NEVER,
      objectPropKeys: ['id', 'name'] as (keyof Indexed)[],
      objectPropStream: NEVER,
      objectIndexReceiver: { ...instance(indexReceiver) },
      stopStream: NEVER
    });

    triggerSync = mock(TriggerSync);
    findIndexSync = new FindIndexSync(instance(triggerSync));
  });

  it(
    'Invoking synchronization - should map dependency to base dependency',
    done => {
      /// Setup
      const objectStream = new Subject<Try<Indexed[]>>();
      const objectPropStream = new Subject<Try<string>>();
      when(dependency.allowInvalidResult).thenReturn(true);
      when(dependency.allObjectStream).thenReturn(objectStream);
      when(dependency.objectPropStream).thenReturn(objectPropStream);
      findIndexSync.synchronize(instance(dependency));
      const mappedDepn = capture(
        triggerSync.synchronize
      ).first()[0] as TriggerDepn<Never<number>>;
      mappedDepn.triggerStream.subscribe({ ...instance(indexReceiver) });

      /// When
      objectStream.next(Try.failure(''));
      objectPropStream.next(Try.failure(''));
      objectStream.next(Try.success([{}, {}, { id: '1', name: '2' }]));
      objectPropStream.next(Try.failure(''));
      objectPropStream.next(Try.success('1'));
      objectPropStream.next(Try.failure(''));
      objectPropStream.next(Try.success('2'));
      objectStream.next(Try.success([{}, {}, {}]));

      setTimeout(() => {
        /// Then
        verify(indexReceiver.next(undefined)).thrice();
        verify(indexReceiver.next(2)).twice();
        verify(indexReceiver.next(anything())).times(5);
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Disallowing invalid results - should filter out invalid results',
    done => {
      /// Setup
      const objectStream = new Subject<Try<Indexed[]>>();
      const objectPropStream = new Subject<Try<string>>();
      when(dependency.allowInvalidResult).thenReturn(false);
      when(dependency.allObjectStream).thenReturn(objectStream);
      when(dependency.objectPropStream).thenReturn(objectPropStream);
      findIndexSync.synchronize(instance(dependency));
      const mappedDepn = capture(
        triggerSync.synchronize
      ).first()[0] as TriggerDepn<Never<number>>;
      mappedDepn.triggerStream.subscribe({ ...instance(indexReceiver) });

      /// When
      objectStream.next(Try.failure(''));
      objectPropStream.next(Try.failure(''));
      objectStream.next(Try.success([{}, {}, { id: '1' }]));
      objectPropStream.next(Try.failure(''));
      objectPropStream.next(Try.success('1'));
      objectStream.next(Try.success([{}, { id: '1', name: '2' }, {}]));
      objectPropStream.next(Try.success('2'));
      objectStream.next(Try.success([{}, {}, {}]));

      setTimeout(() => {
        /// Then
        verify(indexReceiver.next(1)).once();
        verify(indexReceiver.next(2)).once();
        verify(indexReceiver.next(anything())).twice();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it(
    'Passing one object key - should be converted into key array',
    done => {
      /// Setup
      const objectStream = new Subject<Try<Indexed[]>>();
      const objectPropStream = new Subject<Try<string>>();
      when(dependency.allowInvalidResult).thenReturn(false);
      when(dependency.allObjectStream).thenReturn(objectStream);
      when(dependency.objectPropStream).thenReturn(objectPropStream);
      when(dependency.objectPropKeys).thenReturn('id');
      findIndexSync.synchronize(instance(dependency));
      const mappedDepn = capture(
        triggerSync.synchronize
      ).first()[0] as TriggerDepn<Never<number>>;
      mappedDepn.triggerStream.subscribe({ ...instance(indexReceiver) });

      /// When
      objectStream.next(Try.success([{}, {}, { id: '1' }]));
      objectPropStream.next(Try.success('1'));
      objectPropStream.next(Try.success('2'));
      objectStream.next(Try.success([{}, { id: '1', name: '2' }, {}]));

      setTimeout(() => {
        /// Then
        verify(indexReceiver.next(2)).once();
        verify(indexReceiver.next(anything())).once();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it('Constructing synchronizer with default arguments - should work', () => {
    const synchronizer2 = new FindIndexSync();
    synchronizer2.synchronize(instance(dependency));
  });
});
