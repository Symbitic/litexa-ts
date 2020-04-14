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

const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');

const SourceCodeGenerator = require('@src/command-line/generators/sourceCodeGenerator');

const Test = require('@test/helpers');

describe('SourceCodeGenerator', function() {
  describe('#description', () => it('has a class property to describe itself', function() {
    assert(SourceCodeGenerator.hasOwnProperty('description'), 'has a property description');
    return expect(SourceCodeGenerator.description).to.equal('litexa entry point');
  }));

  describe('generate', function() {
    let options = undefined;
    let loggerInterface = undefined;
    let mockLanguage = undefined;

    beforeEach(function() {
      options = {
        root: '.',
        configLanguage: 'javascript',
        sourceLanguage: 'javascript',
        bundlingStrategy: 'none',
        projectConfig: {
          name: 'test'
        }
      };
      loggerInterface = {
        log() { return undefined; }
      };
      return mockLanguage = {
        code: {
          files: ['main.litexa']
        }
      };
    });

    afterEach(function() {
      const dir = 'litexa';
      if (fs.existsSync(dir)) {
        return rimraf.sync(dir);
      }
    });

    it('returns a promise', function() {
      //const hasCodeStub = stub(SourceCodeGenerator.prototype, '_hasLitexaCode').returns(true);
      const sourceCodeGenerator = new SourceCodeGenerator({
        options,
        logger: loggerInterface,
        projectInfoClass: Test.MockProjectInfoInterface,
        templateFilesHandlerClass: Test.MockFileHandlerInterface,
        directoryCreatorClass: Test.MockDirectoryCreatorInterface
      });
      const hasCodeStub = stub(sourceCodeGenerator, '_hasLitexaCode').returns(true);
      assert.typeOf(sourceCodeGenerator.generate(), 'promise', 'it returns a promise');
      hasCodeStub.restore();
    });

    /*
    it('creates the directory structure', function() {
      const hasCodeStub = stub(SourceCodeGenerator.prototype, '_hasLitexaCode').returns(true);
      const createSpy = spy(Test.MockDirectoryCreator.prototype, 'create');

      const sourceCodeGenerator = new SourceCodeGenerator({
        options,
        logger: loggerInterface,
        projectInfoClass: Test.MockProjectInfoInterface,
        templateFilesHandlerClass: Test.MockFileHandlerInterface,
        directoryCreatorClass: Test.MockDirectoryCreatorInterface
      });
      sourceCodeGenerator.generate();

      assert(createSpy.calledOnce, 'created the directory structure');
      return hasCodeStub.restore();
    });
    */

    /*
    return it('synchronizes the directory if no litexa code exists', function() {
      const hasCodeStub = stub(SourceCodeGenerator.prototype, '_hasLitexaCode').returns(false);
      const logSpy = spy(loggerInterface, 'log');
      const syncSpy = spy(Test.MockDirectoryCreator.prototype, 'sync');

      const sourceCodeGenerator = new SourceCodeGenerator({
        options,
        logger: loggerInterface,
        projectInfoClass: Test.MockProjectInfoInterface,
        templateFilesHandlerClass: Test.MockFileHandlerInterface,
        directoryCreatorClass: Test.MockDirectoryCreatorInterface
      });
      sourceCodeGenerator.generate();

      assert(syncSpy.calledOnce, 'created the directory structure');
      assert(logSpy.calledWith(match("no code files found in litexa -> creating them")),
        'informed the user it was going to create the files');
      return hasCodeStub.restore();
    });
    */
  });
});
