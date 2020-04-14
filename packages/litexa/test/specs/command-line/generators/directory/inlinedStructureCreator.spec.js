/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const {assert} = require('chai');
const {match,spy,stub} = require('sinon');

const path = require('path');

const InlinedStructureCreator = require('@src/command-line/generators/directory/inlinedStructureCreator');

describe('InlinedStructureCreator', function() {
  const rootPath = '.';
  let loggerInterface = undefined;
  let templateFilesHandler = undefined;
  beforeEach(function() {
    loggerInterface = {
      log() { return undefined; }
    };
    return templateFilesHandler = {
      syncDir() { return undefined; }
    };
  });

  /*
  describe('#create', () => it('creates the appropriate directory structure', function() {
    const ensureDirExistsStub = stub(InlinedStructureCreator, 'ensureDirExists').callsFake(() => true);
    const inlinedStructureCreator = new InlinedStructureCreator({
      logger: loggerInterface,
      rootPath
    });

    inlinedStructureCreator.create();

    return assert(ensureDirExistsStub.calledWith('litexa'), 'created the litexa directory');
  }));
  */

  return describe('#sync', function() {
    it('targets the correct destination directory', function() {
      const syncDirSpy = spy(templateFilesHandler, 'syncDir');

      const inlinedStructureCreator = new InlinedStructureCreator({
        logger: loggerInterface,
        sourceLanguage: 'javascript',
        bundlingStrategy: 'none',
        rootPath,
        templateFilesHandler
      });

      inlinedStructureCreator.sync();

      return assert(syncDirSpy.calledWith(match({destination: 'litexa'})), 'targets the litexa directory');
    });


    it('targets the correct directories for none bundling with JavaScript', function() {
      const syncDirSpy = spy(templateFilesHandler, 'syncDir');
      const inlinedStructureCreator = new InlinedStructureCreator({
        logger: loggerInterface,
        sourceLanguage: 'javascript',
        bundlingStrategy: 'none',
        rootPath,
        templateFilesHandler
      });

      inlinedStructureCreator.sync();

      const expectedDirs = [
        path.join('common', 'litexa'),
        path.join('common', 'javascript'),
        path.join('inlined', 'javascript')
      ];

      return assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirs})), 'reads from the correct directories');
    });

    it('targets the correct directories for none bundling with TypeScript', function() {
      const syncDirSpy = spy(templateFilesHandler, 'syncDir');
      const inlinedStructureCreator = new InlinedStructureCreator({
        logger: loggerInterface,
        sourceLanguage: 'typescript',
        bundlingStrategy: 'none',
        rootPath,
        templateFilesHandler
      });

      inlinedStructureCreator.sync();

      const expectedDirs = [
        path.join('common', 'litexa'),
        path.join('common', 'typescript'),
        path.join('inlined', 'typescript')
      ];

      return assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirs})), 'reads from the correct directories');
    });

    return it('targets the correct directories for none bundling with CoffeeScript', function() {
      const syncDirSpy = spy(templateFilesHandler, 'syncDir');
      const inlinedStructureCreator = new InlinedStructureCreator({
        logger: loggerInterface,
        sourceLanguage: 'coffee',
        bundlingStrategy: 'none',
        rootPath,
        templateFilesHandler
      });

      inlinedStructureCreator.sync();

      const expectedDirs = [
        path.join('common', 'litexa'),
        path.join('common', 'coffee'),
        path.join('inlined', 'coffee')
      ];

      return assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirs})), 'reads from the correct directories');
    });
  });
});
