import { Ignore } from 'javascriptutilities';
import { merge, NextObserver, Observable, Subscription } from 'rxjs';
import { delay, takeUntil } from 'rxjs/operators';

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

  public synchronize(dependency: Depn) {
    this.subscription.add(merge(
      dependency.progressStartStream,
      dependency.progressEndStream.pipe(delay(0)),
    ).pipe(takeUntil(dependency.stopStream)
    ).subscribe(dependency.progressReceiver));
  }
}
