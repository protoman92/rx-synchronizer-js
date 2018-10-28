import {of, throwError} from 'rxjs';
import {createObservable} from 'sync-util';

describe('Utilities should work correctly', () => {
  it('Creating observables should work correctl', async () => {
    /// Setup && When && Then
    expect(await createObservable(Promise.resolve(1)).toPromise()).toEqual(1);
    expect(await createObservable(of(1)).toPromise()).toEqual(1);

    try {
      await createObservable(Promise.reject(1)).toPromise();
      fail('Never should have come here');
    } catch (e) {}

    try {
      await createObservable(throwError('')).toPromise();
      fail('Never should have come here');
    } catch (e) {}
  });
});
