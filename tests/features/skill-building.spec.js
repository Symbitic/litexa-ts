/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import assert from 'assert';
import path from 'path';
import { fake } from 'sinon';
import build from '@litexa/core/src/command-line/skill-builder';
import config from '@litexa/core/src/command-line/project-config';

describe('supports building a skill', function() {
  const root = path.join(__dirname, '..', 'data', 'simple-skill');

  it('validates skill names', async function() {
    const fakeValidator = fake.returns(false);
    await config.loadConfig(root, fakeValidator);
    assert.equal(true, fakeValidator.calledOnce);
  });

  it('finds the config file in the same directory', async function() {
    const loaded = await config.loadConfig(root);
    assert.ok(loaded);
    assert.equal('simpleSkillTest', loaded.name);
  });

  it('finds the config file in a parent directory', async function() {
    const loaded = await config.loadConfig(root);
    assert.ok(loaded);
    assert.equal('simpleSkillTest', loaded.name);
  });

  it('builds a skill', async function() {
    return build.build(root);
  });
});
