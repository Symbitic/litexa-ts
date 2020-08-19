/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const preamble = require('../preamble');

describe('supports lexical scoping', () => {
  it('runs the lexical-scoping integration test', () => {
    return preamble.runSkill('lexical-scoping');
  });
});
