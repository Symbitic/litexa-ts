/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const assert = require('assert');
const path = require('path');

const { fake } = require('sinon');

const build = require('@litexa/core/src/command-line/skill-builder');
const config = require('@litexa/core/src/command-line/project-config');

describe('build the comments skill', () => {
  it('should validate skill name', async () => {
    const root = path.join(__dirname, '..', 'data', 'comments');
    const fakeValidator = fake.returns(false);
    await config.loadConfig(root, fakeValidator);
    assert.equal(true, fakeValidator.calledOnce);
  });

  it('should find the config file in the same directory', async () => {
    const root = path.join(__dirname, '..', 'data', 'comments');
    const loaded = await config.loadConfig(root);
    assert.ok(loaded);
    assert.equal('commentTests', loaded.name);
  });

  it('should build the comments skill successfully', () => {
    const root = path.join(__dirname, '..', 'data', 'comments');
    return build.build(root);
  });
});
