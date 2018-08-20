import { Ignore } from 'javascriptutilities';
import { merge, NextObserver, Observable, Subscription } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

export interface Depn {
  readonly progressReceiver: NextObserver<boolean>;
  readonly progressStartStream: Observable<Ignore>;
  readonly progressEndStream: Observable<Ignore>;
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
      dependency.progressStartStream.pipe(map(() => true)),
      dependency.progressEndStream.pipe(map(() => false)),
    ).pipe(takeUntil(dependency.stopStream)
    ).subscribe(dependency.progressReceiver));
  }
}
