/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const {assert} = require('chai');
const {match,spy,stub} = require('sinon');

const path = require('path');

const BundlerStructureCreator = require('@src/command-line/generators/directory/bundlerStructureCreator');

describe('BundlerStructureCreator', function() {
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
    const ensureDirExistsStub = stub(BundlerStructureCreator, 'ensureDirExists').callsFake(() => true);
    const bundlerStructureCreator = new BundlerStructureCreator({
      logger: loggerInterface,
      rootPath
    });

    bundlerStructureCreator.create();

    assert(ensureDirExistsStub.calledWith('litexa'), 'created the litexa directory');
    assert(ensureDirExistsStub.calledWith(path.join('lib', 'services')), 'created the lib services directory');
    return assert(ensureDirExistsStub.calledWith(path.join('lib', 'components')), 'created the lib components directory');
  }));
  */

  return describe('#sync', function() {
    it('targets the correct destination directory', function() {
      const syncDirSpy = spy(templateFilesHandler, 'syncDir');

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
      assert(syncDirSpy.calledWith(match({destination: path.join('lib', 'services')})), 'targets the lib services directory');
      assert(syncDirSpy.calledWith(match({destination: path.join('lib', 'components')})), 'targets the lib components directory');
      assert(syncDirSpy.calledWith(match({destination: path.join('test', 'services')})), 'targets the test services directory');
      return assert(syncDirSpy.calledWith(match({destination: path.join('test', 'components')})), 'targets the test components directory');
    });


    it('targets the correct directories for webpack bundling with JavaScript', function() {
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
        path.join('common', 'litexa')
      ];
      const expectedDirsJavaScript = [
        path.join('common', 'javascript'),
        path.join('bundled', 'javascript')
      ];

      assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirsLitexa})),
        'reads from the correct directories for the litexa files');
      return assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirsJavaScript})),
        'reads from the correct directories for the JavaScript files');
    });

    it('targets the correct directories for webpack bundling with TypeScript', function() {
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
        path.join('common', 'litexa')
      ];
      const expectedDirsTypeScript = [
        path.join('common', 'typescript', 'config'),
        path.join('bundled', 'typescript', 'config'),
        path.join('common', 'typescript', 'source'),
        path.join('bundled', 'typescript', 'source')
      ];

      assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirsLitexa})),
        'reads from the correct directories for the litexa files');
      return assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirsTypeScript})),
        'reads from the correct directories for the TypeScript files');
    });

    return it('targets the correct directories for webpack bundling with CoffeeScript', function() {
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
        path.join('common', 'litexa')
      ];
      const expectedDirsCoffeeScript = [
        path.join('common', 'coffee'),
        path.join('bundled', 'coffee')
      ];

      assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirsLitexa})),
        'reads from the correct directories for the litexa files');
      return assert(syncDirSpy.calledWith(match({sourcePaths: expectedDirsCoffeeScript})),
        'reads from the correct directories for the CoffeeScript files');
    });
  });
});
