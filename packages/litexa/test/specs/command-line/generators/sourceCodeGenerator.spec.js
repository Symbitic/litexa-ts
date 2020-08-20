/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { assert, expect } from 'chai';
import { stub } from 'sinon';
import { existsSync } from 'fs';
import { sync } from 'rimraf';

import SourceCodeGenerator from '../../../../src/command-line/generators/sourceCodeGenerator';
import Test from '../../../helpers';

describe('SourceCodeGenerator', () => {
  describe('#description', () => it('has a class property to describe itself', () => {
    assert(SourceCodeGenerator.hasOwnProperty('description'), 'has a property description');
    expect(SourceCodeGenerator.description()).to.equal('litexa entry point');
  }));

  describe('generate', () => {
    let options = undefined;
    let loggerInterface = undefined;
    let mockLanguage = undefined;

    beforeEach(() => {
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
      if (existsSync(dir)) {
        return sync(dir);
      }
    });

    it('returns a promise', () => {
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
    it('creates the directory structure', () => {
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
    return it('synchronizes the directory if no litexa code exists', () => {
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
