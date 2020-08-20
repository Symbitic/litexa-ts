/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { assert, expect } from 'chai';
import { match, spy, stub } from 'sinon';
import { existsSync } from 'fs';
import { sync as mkdirp } from 'mkdirp';
import { join } from 'path';
import { sync as rimraf } from 'rimraf';

import SkillIconsGenerator from '../../../../src/command-line/generators/skillIconsGenerator';

describe('SkillIconsGenerator', () => {
  describe('#description', () => it('has a class property to describe itself', () => {
    assert(SkillIconsGenerator.hasOwnProperty('description'), 'has a property description');
    expect(SkillIconsGenerator.description()).to.equal('skill icons');
  }));

  describe('#generate', () => {
    let loggerInterface = undefined;
    let options = undefined;

    beforeEach(function() {
      options = {
        root: '.'
      };
      loggerInterface = {
        log() { return undefined; }
      };
      mkdirp(join('litexa', 'assets'));
    });

    afterEach(() => rimraf(join('litexa', 'assets')));

    it('returns a promise', () => {
      const skillIconsGenerator = new SkillIconsGenerator({
        options,
        logger: loggerInterface
      });

      assert.typeOf(skillIconsGenerator.generate(), 'promise', 'returns a promise');
    });

    it('calls to create 108 and 512 sized icons', () => {
      const iconStub = stub(SkillIconsGenerator.prototype, '_ensureIcon').callsFake(() => undefined);
      const skillIconsGenerator = new SkillIconsGenerator({
        options,
        logger: loggerInterface
      });

      skillIconsGenerator.generate();

      assert(iconStub.calledWithExactly(108), 'made call to generate 108 sized icon');
      assert(iconStub.calledWithExactly(512), 'made call to generate 512 sized icon');
      return iconStub.restore();
    });


    it('wrote both files', () => {
      const skillIconsGenerator = new SkillIconsGenerator({
        options,
        logger: loggerInterface
      });

      skillIconsGenerator.generate();

      assert(existsSync(join('litexa', 'assets', 'icon-108.png')), 'wrote the 108 sized icon');
      assert(existsSync(join('litexa', 'assets', 'icon-512.png')), 'wrote the 512 sized icon');
    });

    it('indicates they already exist if they already exist', () => {
      const logSpy = spy(loggerInterface, 'log');

      const skillIconsGenerator = new SkillIconsGenerator({
        options,
        logger: loggerInterface
      });

      skillIconsGenerator.generate();
      skillIconsGenerator.generate();

      assert(logSpy.calledWith(match('found -> skipping creation')),
        'indicated that the file already existed');
    });
  });
});
