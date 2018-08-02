# rx-synchronizer-js
[![npm version](https://badge.fury.io/js/rx-synchronizer.svg)](https://badge.fury.io/js/rx-synchronizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://travis-ci.org/protoman92/rx-synchronizer-js.svg?branch=master)](https://travis-ci.org/protoman92/rx-synchronizer-js)
[![Coverage Status](https://coveralls.io/repos/github/protoman92/rx-synchronizer-js/badge.svg?branch=master)](https://coveralls.io/github/protoman92/rx-synchronizer-js?branch=master)

Commonly-used synchronizer bases that can be composed into more specific purposes. Currently there are:

- **Cleanup** synchronizer: performs some clean-up when a trigger is fired. This can be useful in frontend applications e.g. when an option is selected and we want to remove all data related to the previous selected option;
- **Fetch** synchronizer: fetches some data based on a parameter stream. This can be useful in e.g. GET operations;
- **Modify** synchronizer: validates and modifies some data base on a parameter stream. This can be useful in e.g. POST operations;
- **Validate** synchronizer: validates some data as it comes in. This can be useful in e.g. validation forms;
