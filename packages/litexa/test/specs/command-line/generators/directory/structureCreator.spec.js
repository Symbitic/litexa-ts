/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { assert, expect } from 'chai';
import { match, spy, stub } from 'sinon';

import { existsSync } from 'fs';
import { sync as _sync } from 'mkdirp';
import { sync as __sync } from 'rimraf';

import StructureCreator from '../../../../../src/command-line/generators/directory/structureCreator';

describe('StructureCreator', () => {
  const tmpDir = 'tmp';
  let loggerInterface = undefined;
  let mkdirpInterface = undefined;

  beforeEach(() => {
    loggerInterface = {
      log() { return undefined; }
    };
    mkdirpInterface = {
      sync() { return undefined; }
    };
    _sync(tmpDir);
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      return __sync(tmpDir);
    }
  });

  describe('#constructor', () => it('assigns args appropriately', () => {
    const creator = new StructureCreator({
      logger: loggerInterface
    });

    assert(creator.hasOwnProperty('logger'), 'created logger on the object as a property');
    expect(creator.logger).to.deep.equal(loggerInterface);
  }));

  describe('#create', () => {
    it('throws an error if you try to call create directly', () => {
      const creator = new StructureCreator({
        logger: loggerInterface
      });

      expect(() => creator.create()).to.throw('StructureCreator#create not implemented');
    });

    it('throws an error if a class that extended it does not implement #create', () => {
      class MockCreator extends StructureCreator {
        constructor(opts) {
          super(opts);
          this.description = 'Mock Creator';
        }
      };

      const creator = new MockCreator({
        logger: loggerInterface
      });

      expect(() => creator.create()).to.throw('MockCreator#create not implemented');
    });
  });

  describe('#sync', () => {
    it('throws an error if you try to call sync directly', () => {
      const creator = new StructureCreator({
        logger: loggerInterface
      });

      expect(() => creator.sync()).to.throw('StructureCreator#sync not implemented');
    });

    it('throws an error if a class that extended it does not implement #sync', () => {
      class MockCreator extends StructureCreator {
        constructor(opts) {
          super(opts);
          this.description = 'Mock Creator';
        }
      }

      const creator = new MockCreator({
        logger: loggerInterface
      });

      expect(() => creator.sync()).to.throw('MockCreator#sync not implemented');
    });
  });

  describe('#ensureDirExists', () => {
    it('does nothing if a directory exists', () => {
      const mkdirSpy = spy(mkdirpInterface, 'sync');

      const structureCreator = new StructureCreator({
        logger: loggerInterface,
        syncDirWriter: mkdirpInterface
      });
      structureCreator.ensureDirExists('tmp');

      assert(mkdirSpy.notCalled, 'did not write to disk');
    });

    it("creates the directory if it doesn't exist and lets the user know", () => {
      __sync(tmpDir);

      const mkdirSpy = spy(mkdirpInterface, 'sync');
      const logSpy = spy(loggerInterface, 'log');

      const structureCreator = new StructureCreator({
        logger: loggerInterface,
        syncDirWriter: mkdirpInterface
      });
      structureCreator.ensureDirExists(tmpDir);

      assert(mkdirSpy.calledOnceWith(tmpDir), 'made call to write to disk only once');
      assert(logSpy.calledWith(match(`no ${tmpDir} directory found -> creating it`)),
        'informs the user that it created a directory');
    });
  });
});
