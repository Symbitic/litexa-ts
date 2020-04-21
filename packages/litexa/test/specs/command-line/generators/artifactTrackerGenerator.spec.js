/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const { assert, expect } = require('chai');
const { match, spy } = require('sinon');

const fs = require('fs');
const Test = require('../../../helpers');
const ArtifactTrackerGenerator = require('../../../../src/command-line/generators/artifactTrackerGenerator');

describe('ArtifactTrackerGenerator', () => {
  describe('#description', () => {
    it('has a class property to describe itself', () => {
      assert(ArtifactTrackerGenerator.hasOwnProperty('description'), 'has a property description');
      expect(ArtifactTrackerGenerator.description).to.equal('artifacts tracker');
    });
  });

  return describe('#generate', () => {
    let loggerInterface = undefined;
    let options = undefined;

    beforeEach(() => {
      options = {
        root: '.'
      };
      loggerInterface = {
        log() {}
      };
    });

    afterEach(() => {
      const filename = 'artifacts.json';
      if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
      }
    });

    it('returns a promise', () => {
      const artifactTrackerGenerator = new ArtifactTrackerGenerator({
        options,
        logger: loggerInterface,
        artifactClass: Test.MockArtifactInterface
      });

      assert.typeOf(artifactTrackerGenerator.generate(), 'promise', 'it returns a promise');
    });

    it('mutates options, as a direct public side-effect', async () => {
      const artifactTrackerGenerator = new ArtifactTrackerGenerator({
        options,
        logger: loggerInterface,
        artifactClass: Test.MockArtifactInterface
      });

      await artifactTrackerGenerator.generate();

      assert(options.hasOwnProperty('artifacts'), 'modified the options to include artifacts');
      expect(options.artifacts).to.deep.equal(Test.mockArtifact);
    });

    it('reads existing artifacts if they exist', async () => {
      fs.writeFileSync('artifacts.json', '{"content":"json"}', 'utf8');
      const logSpy = spy(loggerInterface, 'log');

      const artifactTrackerGenerator = new ArtifactTrackerGenerator({
        options,
        logger: loggerInterface,
        artifactClass: Test.MockArtifactInterface
      });

      await artifactTrackerGenerator.generate();

      const data = fs.readFileSync('artifacts.json', 'utf8');
      assert(logSpy.calledOnceWith(match('existing artifacts.json found -> skipping creation')), 'informed user the file already exists');
      assert(data === '{"content":"json"}', 'did not override file');
    });

    it('makes a call to saveGlobal when file exists', async () => {
      fs.writeFileSync('artifacts.json', '{"content":"json"}', 'utf8');
      const constructorSpy = spy(Test, 'MockArtifactInterface');
      const saveSpy = spy(Test.MockArtifactInterface.prototype, 'saveGlobal');

      const artifactTrackerGenerator = new ArtifactTrackerGenerator({
        options,
        logger: loggerInterface,
        artifactClass: Test.MockArtifactInterface
      });

      await artifactTrackerGenerator.generate();

      assert(constructorSpy.calledWithNew(), 'instantiated artifact class');
      assert(constructorSpy.calledWith('artifacts.json', { "content": "json" }), 'called the constructor with the right arguments');
      assert(saveSpy.calledOnceWith('last-generated', match.number), 'called save spy with appropriate arguments');

      constructorSpy.restore();
      saveSpy.restore();
    });

    it('makes a call to saveGlobal when file does not', async () => {
      const constructorSpy = spy(Test, 'MockArtifactInterface');
      const saveSpy = spy(Test.MockArtifactInterface.prototype, 'saveGlobal');

      const artifactTrackerGenerator = new ArtifactTrackerGenerator({
        options,
        logger: loggerInterface,
        artifactClass: Test.MockArtifactInterface
      });

      await artifactTrackerGenerator.generate();

      assert(constructorSpy.calledWithNew(), 'instantiated artifact class');
      assert(constructorSpy.calledWith('artifacts.json', {}), 'called the constructor with the right arguments');
      assert(saveSpy.calledOnceWith('last-generated', match.number), 'called save spy with appropriate arguments');

      constructorSpy.restore();
      saveSpy.restore();
    });
  });
});
