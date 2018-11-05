# rx-synchronizer-js

[![npm version](https://badge.fury.io/js/rx-synchronizer.svg)](https://badge.fury.io/js/rx-synchronizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://travis-ci.org/protoman92/rx-synchronizer-js.svg?branch=master)](https://travis-ci.org/protoman92/rx-synchronizer-js)
[![Coverage Status](https://coveralls.io/repos/github/protoman92/rx-synchronizer-js/badge.svg?branch=master)](https://coveralls.io/github/protoman92/rx-synchronizer-js?branch=master)

Commonly-used synchronizer bases that can be composed into more specific purposes. Currently there are:

- **Fetch** synchronizer: fetches some data based on a parameter stream. This can be useful in GET operations:

```typescript
fetchSync.synchronize({
  paramStream: userIdStream,                                      // Observable<Try<string>>
  fetchWithParams: (userId) => repository.user.fetchUser(userId), // (id: string) => Observable<User>
  errorReceiver: globalErrorSubject,                              // NextObserver<Error>
  progressReceiver: profileScreenProgressTrigger,                 // NextObserver<boolean>
  stopStream: profileScreenCleanUpStream,                         // Observable<Ignore>
})
```

- **Modify** synchronizer: validates and modifies some data base on a parameter stream. This can be useful in POST operations;

```typescript
modifySync.synchronize({
  paramStream: updatedUserStream,                                 // Observable<Try<User>>
  modifyWithParams: (user) => repository.user.updateUser(user),   // (user: User) => Observable<unknown>
  validateParams: (user) => validator.user.validate(user),        // (user: User) => Error[]
  errorReceiver: globalErrorSubject,                              // NextObserver<Error>
  progressReceiver: profileScreenProgressTrigger,                 // NextObserver<boolean>
  stopStream: profileScreenCleanUpStream,                         // Observable<Ignore>
})
```

- **Trigger** synchronizer: performs some action when a trigger is fired. This can be useful in frontend applications e.g. when an option is selected and we want to remove all data related to the previous selected option;

```typescript
triggerSync.synchronize({
  triggerStream: profileScreenCleanUpStream,                      // Observable<Ignore>
  triggerReceiver: profileScreenCleanUpReceiver,                  // NextObserver<Ignore>
  stopStream: profileScreenCleanUpStream,                         // Observable<Ignore>
})
```

- **Validate** synchronizer: validates some data as it comes in. This can be useful in e.g. validation forms;

```typescript
validateSync.synchronize({
  objectStream: combineLatest(
    usernameStream,                                               // Observable<Try<string>>
    passwordStream,                                               // Observable<Try<string>>
    (uTrigger, pTrigger) => {                                     // Observable<Try<Readonly<{...}>>>
      return uTrigger.zipWith(pTrigger, (username, password) => {
        return { username, password };
      }
    }
  ),
  stopStream: loginScreenCleanUpStream,                           // Observable<Ignore>
  errorReceiver: globalErrorSubject,                              // NextObserver<Error>
  validateObject: credentials => {
    return validator.auth.validateCredentials(credentials)        // (creds: Readonly<{...}>) => Error[]
  },
})
```

The **Fetch** and **Modify** synchronizers also take care of progress/error emissions automatically, so there is no need to catch errors during actual communications with remote server.
