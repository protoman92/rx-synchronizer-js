import { Ignore, IGNORE, Numbers } from 'javascriptutilities';
import { Depn as ProgressDepn, Impl as ProgressSync } from 'progress';
import { NEVER, NextObserver, Subject } from 'rxjs';
import { anything, instance, spy, verify, when } from 'ts-mockito-2';

describe('Progress sync should work correctly', () => {
  let timeout = 100;
  let dependency: ProgressDepn;
  let progressSync: ProgressSync;
  let progressReceiver: NextObserver<boolean>;

  beforeEach(() => {
    progressReceiver = spy({ next: () => { } });

    dependency = spy({
      progressReceiver: { ...instance(progressReceiver) },
      progressStartStream: NEVER,
      progressEndStream: NEVER,
      stopStream: NEVER,
    });

    progressSync = new ProgressSync();
  });

  it('Triggering progress events - should emit flags sequentially', done => {
    /// Setup
    let progressStartStream = new Subject<true>();
    let progressEndStream = new Subject<false>();
    when(dependency.progressStartStream).thenReturn(progressStartStream);
    when(dependency.progressEndStream).thenReturn(progressEndStream);
    progressSync.synchronize(instance(dependency));

    /// When
    progressStartStream.next(true);
    progressEndStream.next(false);

    /// Then
    setTimeout(() => {
      verify(progressReceiver.next(anything())).twice();
      verify(progressReceiver.next(true)).calledBefore(progressReceiver.next(false));
      done();
    }, 1);
  }, timeout);

  it('Sending stop signal - should unsubscribe all streams', () => {
    /// Setup
    let progressStartStream = new Subject<true>();
    let progressEndStream = new Subject<false>();
    let stopStream = new Subject<Ignore>();
    when(dependency.progressStartStream).thenReturn(progressStartStream);
    when(dependency.progressEndStream).thenReturn(progressEndStream);
    when(dependency.stopStream).thenReturn(stopStream);
    progressSync.synchronize(instance(dependency));

    /// When
    stopStream.next(IGNORE);
    Numbers.range(0, 1000).forEach(() => progressStartStream.next(true));
    Numbers.range(0, 1000).forEach(() => progressEndStream.next(false));

    /// Then
    verify(progressReceiver.next(anything())).never();
  });
});
