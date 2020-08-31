/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import errors from './errors';
import jsonValidator from './jsonValidator';
import dataTable from './dataTable';
import testing from './testing';
import variableReference from './variableReference';
import say from './say';
import card from './card';
import func from './function';
import assets from './assets';
import soundEffect from './soundEffect';
import intent from './intent';
import state from './state';
import monetization from './monetization';

let lib = {};

export function resetLib() {
  for (let k in lib) {
    delete lib[k];
  }

  const mergeLib = required => {
    for (let name in required.lib) {
      const part = required.lib[name];
      lib[name] = part;
    }
  };
  const mergeLib2 = required => {
    for (let name in required) {
      const part = required[name];
      lib[name] = part;
    }
  };

  lib.__resetLib = resetLib;

  mergeLib2(errors);
  mergeLib(jsonValidator);
  mergeLib(dataTable);
  mergeLib(testing);
  mergeLib(variableReference);
  mergeLib2(say);
  mergeLib(card);
  mergeLib(func);
  mergeLib(assets);
  mergeLib(soundEffect);
  mergeLib(intent);
  mergeLib(state);
  mergeLib(monetization);

  // reset the static index of all utterances
  return lib.Intent.unregisterUtterances();
};

resetLib();

export default lib;
