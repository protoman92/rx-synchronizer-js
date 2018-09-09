import {Ignore} from 'javascriptutilities';
import {merge, NextObserver, Observable, Subscription} from 'rxjs';
import {delay, takeUntil} from 'rxjs/operators';
type MergeDepn = Pick<Depn, 'progressStartStream' | 'progressEndStream'>;

export interface Depn {
  readonly progressReceiver: NextObserver<boolean>;
  readonly progressStartStream: Observable<true>;
  readonly progressEndStream: Observable<false>;
  readonly stopStream: Observable<Ignore>;
}

export interface Type {
  synchronize(dependency: Depn): void;
}

export class Impl implements Type {
  private readonly subscription: Subscription;

  public constructor() {
    this.subscription = new Subscription();
  }

  public mergeProgressStreams(dependency: MergeDepn) {
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
