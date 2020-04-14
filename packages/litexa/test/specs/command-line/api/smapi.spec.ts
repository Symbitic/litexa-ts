/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { expect } from 'chai';
import { assert, stub, SinonStub } from 'sinon';

const smapi = require('@src/command-line/api/smapi');

interface Args {
  askProfile?: string;
  command?: string;
  params?: {
    [param: string]: string;
  }
};

describe('Spawning ASK CLI command to call SMAPI (TS)', () => {
  const args: Args = {};

  beforeEach(() => {
    args.askProfile = undefined;
    args.command = undefined;

    const fakeSpawn = () => Promise.resolve({ stdout: '', stderr: '' });
    stub(smapi, 'spawnPromise').callsFake(fakeSpawn);
    stub(console, 'error');
  });

  afterEach(() => {
    (smapi.spawnPromise as SinonStub).restore();
    (console.error as SinonStub).restore();
  });

  it('errors on missing command', () => {
    args.askProfile = 'myProfile';
    expect(() => smapi.call(args)).to.throw(Error, "called without a command");
  });

  it('errors on missing ASK profile', () => {
    args.command = '--help';

    expect(() => smapi.call(args)).to.throw(Error, "missing an ASK profile");
  });

  it('spawns correct CLI output for given command/params', () => {
    args.askProfile = 'mockProfileId';
    args.command = 'associate-isp';
    args.params = {
      'isp-id': 'mockIspId',
      'skill-id': 'mockSkillId'
    };

    smapi.call(args);
    const expectedArgs = [
      'api',
      'associate-isp',
      '--profile',
      'mockProfileId',
      '--isp-id',
      'mockIspId',
      '--skill-id',
      'mockSkillId'
    ];
    //return assert.calledWithExactly(spawnStub, 'ask', expectedArgs);
    const spawnStub = smapi.spawnPromise as SinonStub;
    assert.calledWithExactly(spawnStub, 'ask', expectedArgs);
  });
});
