/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import preamble from '../preamble';

describe('supports the @litexa/apl extension', () => {
  it('runs the apl integration test', () => {
    return preamble.runSkill('apl');
  });
});
