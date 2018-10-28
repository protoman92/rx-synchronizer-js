import { Ignore } from 'javascriptutilities';
import { NextObserver, Observable, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export type Depn<Param = Ignore> = Readonly<{
  triggerStream: Observable<Param>;
  triggerReceiver: NextObserver<Param>;
  stopStream: Observable<Ignore>;
}>;

/**
 * Synchronizer that performs some action on trigger.
 */
export type Type = Readonly<{
  synchronize: <Param = Ignore>(dependency: Depn<Param>) => void;
}>;

export class Impl implements Type {
  private subscription: Subscription;

  public constructor() {
    this.subscription = new Subscription();
  }

  public synchronize<Param = Ignore>(dependency: Depn<Param>) {
    const subscription = this.subscription;

    subscription.add(
      dependency.triggerStream
        .pipe(takeUntil(dependency.stopStream))
        .subscribe(dependency.triggerReceiver)
    );
  }
}
