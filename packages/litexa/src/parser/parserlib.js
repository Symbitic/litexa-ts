/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import errors from './errors';
import testing from './testing';
import say from './say';
import * as jsonValidator from './jsonValidator';
import * as dataTable from './dataTable';
import * as variableReference from './variableReference';
import * as card from './card';
import * as func from './function';
import * as assets from './assets';
import * as soundEffect from './soundEffect';
import * as intent from './intent';
import * as state from './state';
import * as monetization from './monetization';

let lib = {};

export function resetLib() {
  for (let k in lib) {
    delete lib[k];
  }

  lib.__resetLib = resetLib;

  const lib2 = {
    ...errors,
    ...jsonValidator,
    ...dataTable,
    ...testing,
    ...variableReference,
    ...say,
    ...card,
    ...func,
    ...assets,
    ...soundEffect,
    ...intent,
    ...state,
    ...monetization
  };

  for (let name in lib2) {
    const part = lib2[name];
    lib[name] = part;
  }

  // reset the static index of all utterances
  return lib.Intent.unregisterUtterances();
};

resetLib();

export default lib;
