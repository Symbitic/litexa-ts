/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import assert from 'assert';
import preamble from '../preamble';

const getUrl = directive => (directive.audioItem && directive.audioItem.stream) ? directive.audioItem.stream.url : null;

describe('supports the playMusic and stopMusic statements', () => {
  it('runs the sound integration test', async () => {
    let directives;
    const result = await preamble.runSkill('sound');

    // result[0] is blank launch response

    directives = result.raw[1].response.response.directives;
    assert.equal(directives.length, 1);
    assert.equal(directives[0].type, 'AudioPlayer.Play');
    assert.equal(getUrl(directives[0]), 'test://default/sound.mp3');

    directives = result.raw[2].response.response.directives;
    assert.equal(directives.length, 1);
    assert.equal(directives[0].type, 'AudioPlayer.Play');
    assert.equal(getUrl(directives[0]), 'https://www.example.com/sound.mp3');

    directives = result.raw[4].response.response.directives;
    assert.equal(directives.length, 1);
    assert.equal(directives[0].type, 'AudioPlayer.Stop');
  });
});
