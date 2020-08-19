/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { assert, expect } from 'chai';
import { match, spy } from 'sinon';
import { existsSync } from 'fs';
import { sync } from 'mkdirp';
import { join } from 'path';
import { sync as _sync } from 'rimraf';
import AssetsDirectoryGenerator from '../../../../src/command-line/generators/assetsDirectoryGenerator';

describe('AssetsDirectoryGenerator', () => {
  describe('#description', () => it('has a class property to describe itself', () => {
    assert(AssetsDirectoryGenerator.hasOwnProperty('description'), 'has a property description');
    expect(AssetsDirectoryGenerator.description).to.equal('assets directory');
  }));

  describe('#generate', () => {
    let loggerInterface = undefined;
    let options = undefined;

    beforeEach(() => {
      options = {
        root: '.'
      };
      loggerInterface = {
        log() { return undefined; }
      };
    });

    afterEach(() => {
      const dirname = join('litexa', 'assets');
      if (existsSync(dirname)) {
        return _sync(dirname);
      }
    });

    it('returns a promise', () => {
      const assetsDirectoryGenerator = new AssetsDirectoryGenerator({
        options,
        logger: loggerInterface
      });

      assert.typeOf(assetsDirectoryGenerator.generate(), 'promise', 'it returns a promise');
    });

    it("doesn't create it if it already exists", async () => {
      sync(join('litexa', 'assets'));

      const logSpy = spy(loggerInterface, 'log');

      const assetsDirectoryGenerator = new AssetsDirectoryGenerator({
        options,
        logger: loggerInterface
      });

      await assetsDirectoryGenerator.generate();

      assert(logSpy.calledWith(match('existing litexa/assets directory found')),
        'it lets the user know the directory already exists');
      assert(logSpy.neverCalledWith(match('creating litexa/assets')),
        'it does not misinform the user');
    });

    it("creates it if doesn't exist", async () => {
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
      assert(existsSync(join('litexa', 'assets')), 'it created the directory');
    });
  });
});
