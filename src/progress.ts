import { Ignore } from 'javascriptutilities';
import { merge, NextObserver, Observable, Subscription } from 'rxjs';
import { delay, takeUntil } from 'rxjs/operators';

export type Depn = Readonly<{
  progressReceiver: NextObserver<boolean>;
  progressStartStream: Observable<true>;
  progressEndStream: Observable<false>;
  stopStream: Observable<Ignore>;
}>;

export type Type = Readonly<{
  synchronize: (dependency: Depn) => void;
}>;

export class Impl implements Type {
  private readonly subscription: Subscription;

  public constructor() {
    this.subscription = new Subscription();
  }

  public mergeProgressStreams(
    dependency: Pick<Depn, 'progressStartStream' | 'progressEndStream'>
  ) {
    return merge(
      dependency.progressStartStream,
      dependency.progressEndStream.pipe(delay(0))
    );
  }

  public synchronize(dependency: Depn) {
    this.subscription.add(
      this.mergeProgressStreams(dependency)
        .pipe(takeUntil(dependency.stopStream))
        .subscribe(dependency.progressReceiver)
    );
  }
}
