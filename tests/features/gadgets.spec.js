/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const preamble = require('../preamble');

describe('supports the gadgets API', () => {
  it('runs the gadgets-api integration test', () => {
    return preamble.runSkill('gadgets');
  });
});
