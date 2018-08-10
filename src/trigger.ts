import { Ignore } from 'javascriptutilities';
import { NextObserver, Observable, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface Depn<Param = Ignore> {
  readonly triggerStream: Observable<Param>;
  readonly triggerReceiver: NextObserver<Param>;
  readonly stopStream: Observable<Ignore>;
}

/**
 * Synchronizer that performs some action on trigger.
 */
export interface Type {
  synchronize(dependency: Depn): void;
}

export class Impl implements Type {
  private subscription: Subscription;

  public constructor() {
    this.subscription = new Subscription();
  }

  public synchronize<Param = Ignore>(dependency: Depn<Param>) {
    let subscription = this.subscription;

    subscription.add(dependency.triggerStream
      .pipe(takeUntil(dependency.stopStream))
      .subscribe(dependency.triggerReceiver));
  }
}
