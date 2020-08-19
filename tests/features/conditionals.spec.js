/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const preamble = require('../preamble');

describe('evaluates if/else/not conditionals correctly', () => {
  it('runs the conditionals integration test', () => {
    return preamble.runSkill('conditionals');
  });
});
