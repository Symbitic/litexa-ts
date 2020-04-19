/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

module.exports = class DBInterface {
  constructor() {
    this.variables = {};
    this.written = false;
    this.initialized = false;
  }

  isInitialized() {
    return this.initialized;
  }

  initialize() {
    this.initialized = true;
  }

  read(name) {
    return this.variables[name];
  }

  write(name, value) {
    this.written = true;
    this.variables[name] = value;
  }

  finalize(cb) {
    return setTimeout(cb, 1);
  }
};
