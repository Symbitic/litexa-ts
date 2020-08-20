/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const lib = {};

const errors = require('./errors');
const jsonValidator = require('./jsonValidator');
const dataTable = require('./dataTable');
const testing = require('./testing');

const resetLib = function() {
  for (let k in lib) {
    delete lib[k];
  }

  lib.__resetLib = resetLib;

  const mergeLib = required => {
    for (let name in required.lib) {
      const part = required.lib[name];
      lib[name] = part;
    }
  };

  mergeLib(require('./errors'));
  mergeLib(require('./jsonValidator'));
  mergeLib(require('./dataTable'));
  mergeLib(require('./testing'));
  mergeLib(require('./variableReference'));
  mergeLib(require('./say'));
  mergeLib(require('./card'));
  mergeLib(require('./function').default);
  mergeLib(require('./assets'));
  mergeLib(require('./soundEffect'));
  mergeLib(require('./intent'));
  mergeLib(require('./state'));
  mergeLib(require('./monetization'));

  // reset the static index of all utterances
  return lib.Intent.unregisterUtterances();
};

resetLib();

module.exports = lib;
