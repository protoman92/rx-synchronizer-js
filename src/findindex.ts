import { Collections, Nullable, Omit, Try } from 'javascriptutilities';
import { mapNonNilOrEmpty } from 'rx-utilities-js';
import { combineLatest, NextObserver, Observable, OperatorFunction } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { Depn as TriggerDepn, Type as TriggerSync } from './trigger';
let deepEqual = require('deep-equal');
type ExcludedKeys = 'triggerReceiver' | 'triggerStream';

export interface Depn<T> extends Omit<TriggerDepn<number>, ExcludedKeys> {
  /**
   * If this is true, invalid results will not be filtered out.
   */
  readonly allowInvalidResult: boolean;
  readonly allObjectStream: Observable<Try<Partial<T>[]>>;
  readonly objectPropKey: keyof T;
  readonly objectPropStream: Observable<Try<any>>;
  readonly objectIndexReceiver: NextObserver<Nullable<number>>;
}

/**
 * Find the index of some object among an array of objects (based on a specified
 * property) and emit that.
 */
export class Impl {
  private readonly triggerSync: TriggerSync;

  public constructor(triggerSync: TriggerSync) {
    this.triggerSync = triggerSync;
  }

  public synchronize<T>(dependency: Depn<T>) {
    let key = dependency.objectPropKey;

    this.triggerSync.synchronize<Nullable<number>>({
      ...dependency as Omit<Depn<T>,
      'allObjectStream' |
      'allowInvalidResult' |
      'objectIndexReceiver' |
      'objectPropStream' |
      'objectPropKey'>,
      triggerReceiver: dependency.objectIndexReceiver,
      triggerStream: combineLatest(
        dependency.allObjectStream,
        dependency.objectPropStream.pipe(distinctUntilChanged((v1, v2) => {
          return deepEqual(v1.value, v2.value);
        })),
        (v1, v2) => v1.zipWith(v2, (objects, prop) => {
          return Collections.indexOf(objects, { [key]: prop } as Partial<T>, (v3, v4) => {
            return deepEqual(v3[key], v4[key]);
          });
        }).flatMap(v => v),
      ).pipe(
        ((): OperatorFunction<Try<number>, Nullable<number>> => {
          if (dependency.allowInvalidResult) {
            return map(v => v.value);
          } else {
            return mapNonNilOrEmpty(v => v.value);
          }
        })(),
        distinctUntilChanged(),
      ),
    });
  }
}
