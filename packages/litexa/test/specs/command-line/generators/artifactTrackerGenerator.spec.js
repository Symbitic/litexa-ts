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
const Test = require('@test/helpers');
const ArtifactTrackerGenerator = require('@src/command-line/generators/artifactTrackerGenerator');

describe('ArtifactTrackerGenerator', function() {
  describe('#description', () => it('has a class property to describe itself', function() {
    assert(ArtifactTrackerGenerator.hasOwnProperty('description'), 'has a property description');
    return expect(ArtifactTrackerGenerator.description).to.equal('artifacts tracker');
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
      const filename = 'artifacts.json';
      if (fs.existsSync(filename)) {
        return fs.unlinkSync(filename);
      }
    });

    it('returns a promise', function() {
      const artifactTrackerGenerator = new ArtifactTrackerGenerator({
        options,
        logger: loggerInterface,
        artifactClass: Test.MockArtifactInterface
      });

      return assert.typeOf(artifactTrackerGenerator.generate(), 'promise', 'it returns a promise');
    });

    it('mutates options, as a direct public side-effect', async function() {
      const artifactTrackerGenerator = new ArtifactTrackerGenerator({
        options,
        logger: loggerInterface,
        artifactClass: Test.MockArtifactInterface
      });

      await artifactTrackerGenerator.generate();

      assert(options.hasOwnProperty('artifacts'), 'modified the options to include artifacts');
      return expect(options.artifacts).to.deep.equal(Test.mockArtifact);
    });

    it('reads existing artifacts if they exist', async function() {
      fs.writeFileSync('artifacts.json', '{"content":"json"}', 'utf8');
      const logSpy = spy(loggerInterface, 'log');

      const artifactTrackerGenerator = new ArtifactTrackerGenerator({
        options,
        logger: loggerInterface,
        artifactClass: Test.MockArtifactInterface
      });

      await artifactTrackerGenerator.generate();

      const data = fs.readFileSync('artifacts.json', 'utf8');
      assert(logSpy.calledOnceWith(match('existing artifacts.json found -> skipping creation')),
        'informed user the file already exists');
      return assert(data === '{"content":"json"}', 'did not override file');
    });

    it('makes a call to saveGlobal when file exists', async function() {
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
      assert(constructorSpy.calledWith('artifacts.json', { "content": "json" }),
        'called the constructor with the right arguments');
      assert(saveSpy.calledOnceWith('last-generated', match.number),
        'called save spy with appropriate arguments');

      constructorSpy.restore();
      return saveSpy.restore();
    });

    return it('makes a call to saveGlobal when file does not', async function() {
      const constructorSpy = spy(Test, 'MockArtifactInterface');
      const saveSpy = spy(Test.MockArtifactInterface.prototype, 'saveGlobal');

      const artifactTrackerGenerator = new ArtifactTrackerGenerator({
        options,
        logger: loggerInterface,
        artifactClass: Test.MockArtifactInterface
      });

      await artifactTrackerGenerator.generate();

      assert(constructorSpy.calledWithNew(), 'instantiated artifact class');
      assert(constructorSpy.calledWith('artifacts.json', {}),
        'called the constructor with the right arguments');
      assert(saveSpy.calledOnceWith('last-generated', match.number),
        'called save spy with appropriate arguments');

      constructorSpy.restore();
      return saveSpy.restore();
    });
  });
});
