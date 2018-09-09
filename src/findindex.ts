import { Collections, Never, Omit, Try } from 'javascriptutilities';
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

  /**
   * Consider an object a match if any of the key defined in this Array has a
   * match.
   */
  readonly objectPropKeys: keyof T | (keyof T)[];

  readonly allObjectStream: Observable<Try<Partial<T>[]>>;
  readonly objectPropStream: Observable<Try<any>>;
  readonly objectIndexReceiver: NextObserver<Never<number>>;
}

export interface Type {
  synchronize<T>(dependency: Depn<T>): void;
}

/**
 * Find the index of some object among an array of objects (based on a specified
 * property) and emit that.
 */
export class Impl implements Type {
  private readonly triggerSync: TriggerSync;

  public constructor(triggerSync: TriggerSync) {
    this.triggerSync = triggerSync;
  }

  public synchronize<T>(dependency: Depn<T>) {
    let keys: (keyof T)[];

    if (dependency.objectPropKeys instanceof Array) {
      keys = dependency.objectPropKeys;
    } else {
      keys = [dependency.objectPropKeys];
    }

    this.triggerSync.synchronize<Never<number>>({
      ...dependency as Omit<Depn<T>,
      'allObjectStream' |
      'allowInvalidResult' |
      'objectIndexReceiver' |
      'objectPropStream' |
      'objectPropKeys'>,
      triggerReceiver: dependency.objectIndexReceiver,
      triggerStream: combineLatest(
        dependency.allObjectStream,
        dependency.objectPropStream.pipe(distinctUntilChanged((v1, v2) => {
          return deepEqual(v1.value, v2.value);
        })),
        (v1, v2) => v1.zipWith(v2, (objects, prop) => {
          let object2: Partial<T> = keys
            .map(k => ({ [k]: prop }))
            .reduce((acc, obj) => Object.assign(acc, obj)) as Partial<T>;

          return Collections.indexOf(objects, object2, (v3, v4) => {
            for (let key of keys) {
              if (deepEqual(v3[key], v4[key])) {
                return true;
              }
            }

            return false;
          });
        }).flatMap(v => v),
      ).pipe(
        ((): OperatorFunction<Try<number>, Never<number>> => {
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
