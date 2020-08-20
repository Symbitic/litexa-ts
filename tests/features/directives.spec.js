/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import assert from 'assert';
import preamble from '../preamble';

describe('supports the directive statement', () => {
  it('runs the directive integration test', async () => {
    const result = await preamble.runSkill('directives')
    const { response } = result.raw[0].response;
    const { directives } = response;
    assert.equal(directives.length, 3);
    assert.equal(directives[0].type, 'AudioPlayer.Play');
    assert.equal(directives[1].type, 'Hint');
    assert.equal(directives[2].type, 'AudioPlayer.Stop');
  });
});
