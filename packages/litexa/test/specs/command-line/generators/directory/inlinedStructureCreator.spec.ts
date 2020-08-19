/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { assert } from 'chai';
import { match, spy, stub } from 'sinon';

import { join } from 'path';

import InlinedStructureCreator from '../../../../../src/command-line/generators/directory/inlinedStructureCreator';

describe('InlinedStructureCreator', () => {
  const rootPath = '.';
  let loggerInterface: any = undefined;
  let templateFilesHandler: any = undefined;
  beforeEach(() => {
    loggerInterface = {
      log() { return undefined; }
    };
    templateFilesHandler = {
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

  describe('#sync', () => {
    it('targets the correct destination directory', () => {
      const syncDirSpy = spy(templateFilesHandler, 'syncDir');

      const inlinedStructureCreator = new InlinedStructureCreator({
        logger: loggerInterface,
        sourceLanguage: 'javascript',
        bundlingStrategy: 'none',
        rootPath,
        templateFilesHandler
      });

      inlinedStructureCreator.sync();

      assert(syncDirSpy.calledWith(match({destination: 'litexa'})), 'targets the litexa directory');
    });


    it('targets the correct directories for none bundling with JavaScript', () => {
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
        join('common', 'litexa'),
        join('common', 'javascript'),
        join('inlined', 'javascript')
      ];

      assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirs})), 'reads from the correct directories');
    });

    it('targets the correct directories for none bundling with TypeScript', () => {
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
        join('common', 'litexa'),
        join('common', 'typescript'),
        join('inlined', 'typescript')
      ];

      assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirs})), 'reads from the correct directories');
    });

    it('targets the correct directories for none bundling with CoffeeScript', () => {
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
        join('common', 'litexa'),
        join('common', 'coffee'),
        join('inlined', 'coffee')
      ];

      assert(syncDirSpy.calledWith(match({ sourcePaths: expectedDirs })), 'reads from the correct directories');
    });
  });
});
