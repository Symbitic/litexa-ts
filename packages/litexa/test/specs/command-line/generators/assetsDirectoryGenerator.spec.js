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
const {match, spy} = require('sinon');

const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const rimraf = require('rimraf');

const AssetsDirectoryGenerator = require('@src/command-line/generators/assetsDirectoryGenerator');

describe('AssetsDirectoryGenerator', function() {
  describe('#description', () => it('has a class property to describe itself', function() {
    assert(AssetsDirectoryGenerator.hasOwnProperty('description'), 'has a property description');
    return expect(AssetsDirectoryGenerator.description).to.equal('assets directory');
  }));

  return describe('#generate', function() {
    let loggerInterface = undefined;
    let options = undefined;

    beforeEach(function() {
      options = {
        root: '.'
      };
      return loggerInterface = {
        log() { return undefined; }
      };});

    afterEach(function() {
      const dirname = path.join('litexa', 'assets');
      if (fs.existsSync(dirname)) {
        return rimraf.sync(dirname);
      }
    });

    it('returns a promise', function() {
      const assetsDirectoryGenerator = new AssetsDirectoryGenerator({
        options,
        logger: loggerInterface
      });

      return assert.typeOf(assetsDirectoryGenerator.generate(), 'promise', 'it returns a promise');
    });

    it("doesn't create it if it already exists", async function() {
      mkdirp.sync(path.join('litexa', 'assets'));

      const logSpy = spy(loggerInterface, 'log');

      const assetsDirectoryGenerator = new AssetsDirectoryGenerator({
        options,
        logger: loggerInterface
      });

      await assetsDirectoryGenerator.generate();

      assert(logSpy.calledWith(match('existing litexa/assets directory found')),
        'it lets the user know the directory already exists');
      return assert(logSpy.neverCalledWith(match('creating litexa/assets')),
        'it does not misinform the user');
    });

    return it("creates it if doesn't exist", async function() {
      const logSpy = spy(loggerInterface, 'log');

      const assetsDirectoryGenerator = new AssetsDirectoryGenerator({
        options,
        logger: loggerInterface
      });

      await assetsDirectoryGenerator.generate();

      assert(logSpy.neverCalledWith(match('existing litexa/assets directory found')),
        'it lets the user know the directory already exists');
      assert(logSpy.calledWith(match('creating litexa/assets')),
        'it does not misinform the user');

      return assert(fs.existsSync(path.join('litexa', 'assets')), 'it created the directory');
    });
  });
});
