/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { assert } from 'chai';
import { match, spy } from 'sinon';
import { join } from 'path';

import BundlerStructureCreator from '../../../../../src/command-line/generators/directory/bundlerStructureCreator';

describe('BundlerStructureCreator', () => {
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
    const ensureDirExistsStub = stub(BundlerStructureCreator, 'ensureDirExists').callsFake(() => true);
    const bundlerStructureCreator = new BundlerStructureCreator({
      logger: loggerInterface,
      rootPath
    });

    bundlerStructureCreator.create();

    assert(ensureDirExistsStub.calledWith('litexa'), 'created the litexa directory');
    assert(ensureDirExistsStub.calledWith(path.join('lib', 'services')), 'created the lib services directory');
    assert(ensureDirExistsStub.calledWith(path.join('lib', 'components')), 'created the lib components directory');
  }));
  */

  describe('#sync', () => {
    it('targets the correct destination directory', () => {
      const syncDirSpy: any = spy(templateFilesHandler, 'syncDir');

      const bundlerStructureCreator = new BundlerStructureCreator({
        logger: loggerInterface,
        sourceLanguage: 'javascript',
        bundlingStrategy: 'none',
        rootPath,
        templateFilesHandler
      });

      bundlerStructureCreator.sync();

      assert(syncDirSpy.calledWith(match({destination: '.'})), 'targets the top level directory');
      assert(syncDirSpy.calledWith(match({destination: 'litexa'})), 'targets the litexa directory');
      assert(syncDirSpy.calledWith(match({destination: 'lib'})), 'targets the lib directory');
      assert(syncDirSpy.calledWith(match({destination: join('lib', 'services')})), 'targets the lib services directory');
      assert(syncDirSpy.calledWith(match({destination: join('lib', 'components')})), 'targets the lib components directory');
      assert(syncDirSpy.calledWith(match({destination: join('test', 'services')})), 'targets the test services directory');
      assert(syncDirSpy.calledWith(match({destination: join('test', 'components')})), 'targets the test components directory');
    });


    it('targets the correct directories for webpack bundling with JavaScript', () => {
      const syncDirSpy = spy(templateFilesHandler, 'syncDir');
      const bundlerStructureCreator = new BundlerStructureCreator({
        logger: loggerInterface,
        sourceLanguage: 'javascript',
        bundlingStrategy: 'webpack',
        rootPath,
        templateFilesHandler
      });

      bundlerStructureCreator.sync();

      const expectedDirsLitexa = [
        join('common', 'litexa')
      ];
      const expectedDirsJavaScript = [
        join('common', 'javascript'),
        join('bundled', 'javascript')
      ];

      assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirsLitexa})),
        'reads from the correct directories for the litexa files');
      assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirsJavaScript})),
        'reads from the correct directories for the JavaScript files');
    });

    it('targets the correct directories for webpack bundling with TypeScript', () => {
      const syncDirSpy = spy(templateFilesHandler, 'syncDir');
      const bundlerStructureCreator = new BundlerStructureCreator({
        logger: loggerInterface,
        sourceLanguage: 'typescript',
        bundlingStrategy: 'webpack',
        rootPath,
        templateFilesHandler
      });

      bundlerStructureCreator.sync();

      const expectedDirsLitexa = [
        join('common', 'litexa')
      ];
      const expectedDirsTypeScript = [
        join('common', 'typescript', 'config'),
        join('bundled', 'typescript', 'config'),
        join('common', 'typescript', 'source'),
        join('bundled', 'typescript', 'source')
      ];

      assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirsLitexa})),
        'reads from the correct directories for the litexa files');
      assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirsTypeScript})),
        'reads from the correct directories for the TypeScript files');
    });

    it('targets the correct directories for webpack bundling with CoffeeScript', () => {
      const syncDirSpy = spy(templateFilesHandler, 'syncDir');
      const bundlerStructureCreator = new BundlerStructureCreator({
        logger: loggerInterface,
        sourceLanguage: 'coffee',
        bundlingStrategy: 'webpack',
        rootPath,
        templateFilesHandler
      });

      bundlerStructureCreator.sync();

      const expectedDirsLitexa = [
        join('common', 'litexa')
      ];
      const expectedDirsCoffeeScript = [
        join('common', 'coffee'),
        join('bundled', 'coffee')
      ];

      assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirsLitexa})),
        'reads from the correct directories for the litexa files');
      assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirsCoffeeScript})),
        'reads from the correct directories for the CoffeeScript files');
    });
  });
});
