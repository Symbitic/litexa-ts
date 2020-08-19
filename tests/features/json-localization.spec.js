/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const preamble = require('../preamble');

describe('supports the JSON localization feature', () => {
  it('runs the json-localization integration test', () => {
    return preamble.runSkill('json-localization');
  });
});
