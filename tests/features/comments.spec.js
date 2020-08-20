/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import builder from '@litexa/core/src/command-line/skill-builder';
import config from '@litexa/core/src/command-line/project-config';
import { equal, ok } from 'assert';
import { join } from 'path';
import { fake } from 'sinon';

describe('build the comments skill', () => {
  it('should validate skill name', async () => {
    const root = join(__dirname, '..', 'data', 'comments');
    const fakeValidator = fake.returns(false);
    await config.loadConfig(root, fakeValidator);
    equal(true, fakeValidator.calledOnce);
  });

  it('should find the config file in the same directory', async () => {
    const root = join(__dirname, '..', 'data', 'comments');
    const loaded = await config.loadConfig(root);
    ok(loaded);
    equal('commentTests', loaded.name);
  });

  it('should build the comments skill successfully', () => {
    const root = join(__dirname, '..', 'data', 'comments');
    return builder.build(root);
  });
});
