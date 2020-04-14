/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const {assert, expect} = require('chai');
const {match, spy, stub} = require('sinon');

const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const rimraf = require('rimraf');

const SkillIconsGenerator = require('@src/command-line/generators/skillIconsGenerator');

describe('SkillIconsGenerator', function() {
  describe('#description', () => it('has a class property to describe itself', function() {
    assert(SkillIconsGenerator.hasOwnProperty('description'), 'has a property description');
    return expect(SkillIconsGenerator.description).to.equal('skill icons');
  }));

  return describe('#generate', function() {
    let loggerInterface = undefined;
    let options = undefined;

    beforeEach(function() {
      options = {
        root: '.'
      };
      loggerInterface = {
        log() { return undefined; }
      };
      return mkdirp.sync(path.join('litexa', 'assets'));
    });

    afterEach(() => rimraf.sync(path.join('litexa', 'assets')));

    it('returns a promise', function() {
      const skillIconsGenerator = new SkillIconsGenerator({
        options,
        logger: loggerInterface
      });

      return assert.typeOf(skillIconsGenerator.generate(), 'promise', 'returns a promise');
    });

    it('calls to create 108 and 512 sized icons', function() {
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


    it('wrote both files', function() {
      const skillIconsGenerator = new SkillIconsGenerator({
        options,
        logger: loggerInterface
      });

      skillIconsGenerator.generate();

      assert(fs.existsSync(path.join('litexa', 'assets', 'icon-108.png')), 'wrote the 108 sized icon');
      return assert(fs.existsSync(path.join('litexa', 'assets', 'icon-512.png')), 'wrote the 512 sized icon');
    });

    return it('indicates they already exist if they already exist', function() {
      const logSpy = spy(loggerInterface, 'log');

      const skillIconsGenerator = new SkillIconsGenerator({
        options,
        logger: loggerInterface
      });

      skillIconsGenerator.generate();
      skillIconsGenerator.generate();

      return assert(logSpy.calledWith(match('found -> skipping creation')),
        'indicated that the file already existed');
    });
  });
});
