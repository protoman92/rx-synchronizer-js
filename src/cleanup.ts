import { Ignore } from 'javascriptutilities';
import { NextObserver, Observable, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface Depn {
  readonly triggerStream: Observable<Ignore>;
  readonly cleanUpReceiver: NextObserver<Ignore>;
  readonly stopStream: Observable<Ignore>;
}

/**
 * Synchronizer that performs some clean-up on trigger.
 */
export interface Type {
  synchronize(dependency: Depn): void;
}

export class Impl implements Type {
  private subscription: Subscription;

  public constructor() {
    this.subscription = new Subscription();
  }

  public synchronize(dependency: Depn) {
    let subscription = this.subscription;

    subscription.add(dependency.triggerStream
      .pipe(takeUntil(dependency.stopStream))
      .subscribe(dependency.cleanUpReceiver));
  }
}
