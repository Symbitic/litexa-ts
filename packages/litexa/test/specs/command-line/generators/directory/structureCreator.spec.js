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
const rimraf = require('rimraf');

const StructureCreator = require('@src/command-line/generators/directory/structureCreator');

describe('StructureCreator', function() {
  const tmpDir = 'tmp';
  let loggerInterface = undefined;
  let mkdirpInterface = undefined;

  beforeEach(function() {
    loggerInterface = {
      log() { return undefined; }
    };
    mkdirpInterface = {
      sync() { return undefined; }
    };
    return mkdirp.sync(tmpDir);
  });

  afterEach(function() {
    if (fs.existsSync(tmpDir)) {
      return rimraf.sync(tmpDir);
    }
  });

  describe('#constructor', () => it('assigns args appropriately', function() {
    const creator = new StructureCreator({
      logger: loggerInterface
    });

    assert(creator.hasOwnProperty('logger'), 'created logger on the object as a property');
    return expect(creator.logger).to.deep.equal(loggerInterface);
  }));

  describe('#create', function() {
    it('throws an error if you try to call create directly', function() {
      const creator = new StructureCreator({
        logger: loggerInterface
      });

      return expect(() => creator.create()).to.throw('StructureCreator#create not implemented');
    });

    return it('throws an error if a class that extended it does not implement #create', function() {
      class MockCreator extends StructureCreator {
        constructor(opts) {
          super(opts);
          this.description = 'Mock Creator';
        }
      };

      const creator = new MockCreator({
        logger: loggerInterface
      });

      return expect(() => creator.create()).to.throw('MockCreator#create not implemented');
    });
  });

  describe('#sync', function() {
    it('throws an error if you try to call sync directly', function() {
      const creator = new StructureCreator({
        logger: loggerInterface
      });

      return expect(() => creator.sync()).to.throw('StructureCreator#sync not implemented');
    });

    return it('throws an error if a class that extended it does not implement #sync', function() {
      class MockCreator extends StructureCreator {
        constructor(opts) {
          super(opts);
          this.description = 'Mock Creator';
        }
      }

      const creator = new MockCreator({
        logger: loggerInterface
      });

      return expect(() => creator.sync()).to.throw('MockCreator#sync not implemented');
    });
  });

  return describe('#ensureDirExists', function() {
    it('does nothing if a directory exists', function() {
      const mkdirSpy = spy(mkdirpInterface, 'sync');

      const structureCreator = new StructureCreator({
        logger: loggerInterface,
        syncDirWriter: mkdirpInterface
      });
      structureCreator.ensureDirExists('tmp');

      return assert(mkdirSpy.notCalled, 'did not write to disk');
    });

    return it("creates the directory if it doesn't exist and lets the user know", function() {
      rimraf.sync(tmpDir);

      const mkdirSpy = spy(mkdirpInterface, 'sync');
      const logSpy = spy(loggerInterface, 'log');

      const structureCreator = new StructureCreator({
        logger: loggerInterface,
        syncDirWriter: mkdirpInterface
      });
      structureCreator.ensureDirExists(tmpDir);

      assert(mkdirSpy.calledOnceWith(tmpDir), 'made call to write to disk only once');
      return assert(logSpy.calledWith(match(`no ${tmpDir} directory found -> creating it`)),
        'informs the user that it created a directory');
    });
  });
});
