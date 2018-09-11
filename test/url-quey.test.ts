import {Undefined} from 'javascriptutilities';
import {BehaviorSubject, NEVER, NextObserver, Subject} from 'rxjs';
import * as TriggerSync from 'trigger';
import {
  anything,
  capture,
  deepEqual,
  instance,
  mock,
  spy,
  verify,
  when,
} from 'ts-mockito-2';
import * as UrlQuerySync from 'url-query';
import {asyncTimeout, asyncWait} from './test-util';

describe('Url query sync should work correctly', () => {
  type Query = Readonly<{a: string; b: string}>;
  let triggerSync: TriggerSync.Type;
  let urlQuerySync: UrlQuerySync.Type;
  let dependency: UrlQuerySync.Depn<Query>;
  let urlQueryReceiver: NextObserver<Query>;

  beforeEach(() => {
    urlQueryReceiver = spy({next: () => {}});

    dependency = spy<UrlQuerySync.Depn<Query>>({
      acceptableUrlPathName: '',
      queryStream: NEVER,
      stopStream: NEVER,
      urlPathNameStream: NEVER,
      urlQueryReceiver: {...instance(urlQueryReceiver)},
    });

    triggerSync = mock(TriggerSync.Impl);
    urlQuerySync = new UrlQuerySync.Impl(instance(triggerSync));
  });

  it(
    'Invoking synchronization - should map to base dependency',
    done => {
      /// Setup
      let acceptableUrlPath = 'acceptable-url';
      let queryStream = new Subject<Query>();
      let urlPathStream = new BehaviorSubject<Undefined<string>>(undefined);
      when(dependency.acceptableUrlPathName).thenReturn(acceptableUrlPath);
      when(dependency.queryStream).thenReturn(queryStream);
      when(dependency.urlPathNameStream).thenReturn(urlPathStream);

      urlQuerySync.synchronize(instance(dependency));
      let mappedDepn = capture(
        triggerSync.synchronize
      ).first()[0] as TriggerSync.Depn<Query>;

      mappedDepn.triggerStream.subscribe({...instance(urlQueryReceiver)});

      /// When
      urlPathStream.next(acceptableUrlPath);
      queryStream.next({a: '1', b: '2'});
      queryStream.next({a: '1', b: '2'});
      queryStream.next({a: '2', b: '3'});
      urlPathStream.next('invalid-url');
      queryStream.next({a: '2', b: '3'});
      queryStream.next({a: '3', b: '4'});
      urlPathStream.next(acceptableUrlPath);

      setTimeout(() => {
        /// Then
        verify(urlQueryReceiver.next(anything())).times(2);
        verify(urlQueryReceiver.next(deepEqual({a: '1', b: '2'}))).once();
        verify(urlQueryReceiver.next(deepEqual({a: '2', b: '3'}))).once();
        verify(urlQueryReceiver.next(deepEqual({a: '3', b: '4'}))).never();
        done();
      }, asyncWait);
    },
    asyncTimeout
  );

  it('Constructing synchronizer with default arguments - should work', () => {
    let urlQuerySync2 = new UrlQuerySync.Impl();
    urlQuerySync2.synchronize(instance(dependency));
  });
});
