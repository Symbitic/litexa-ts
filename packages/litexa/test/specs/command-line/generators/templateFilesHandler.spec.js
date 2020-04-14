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

const TemplateFilesHandler = require('@src/command-line/generators/templateFilesHandler');

describe('TemplateFilesHandler', function() {
  const tmpDir = 'tmp';
  let loggerInterface = undefined;
  let filesHandler = undefined;

  beforeEach(function() {
    loggerInterface = {
      log() { return undefined; }
    };
    filesHandler = new TemplateFilesHandler({
      logger: loggerInterface
    });
    return mkdirp.sync(tmpDir);
  });

  afterEach(function() {
    if (fs.existsSync(tmpDir)) {
      return rimraf.sync(tmpDir);
    }
  });

  return describe('#syncDir', function() {
    it("doesn't write any files if no whitelist is provided", function() {
      filesHandler.syncDir({
        sourcePaths: [path.join('common', 'litexa')],
        destination: 'tmp'
      });
      assert(!fs.existsSync(path.join('tmp', 'main.litexa')),
        "main file did not get created because it wasn't whitelisted");
      return assert(!fs.existsSync(path.join('tmp', 'main.test.litexa')),
        "main test file did not get created because it wasn't whitelisted");
    });

    it('only writes the files that are whitelisted', function() {
      filesHandler.syncDir({
        sourcePaths: [path.join('common', 'litexa')],
        destination: 'tmp',
        whitelist: ['main.litexa$']
      });
      assert(fs.existsSync(path.join('tmp', 'main.litexa')), 'main file was created');
      return assert(!fs.existsSync(path.join('tmp', 'main.test.litexa')),
        "main test file did not get created because it wasn't whitelisted");
    });

    it('applies each whitelist regex', function() {
      filesHandler.syncDir({
        sourcePaths: [path.join('common', 'litexa')],
        destination: 'tmp',
        whitelist: [
          'main.litexa$',
          'main.test.litexa$'
        ]
      });
      assert(fs.existsSync(path.join('tmp', 'main.litexa')), 'main file was created');
      return assert(fs.existsSync(path.join('tmp', 'main.test.litexa')), 'main test file created');
    });

    it('reads from multiple directories and cascades files based on order', function() {
      filesHandler.syncDir({
        sourcePaths: [
          path.join('common', 'typescript', 'source'),
          path.join('bundled', 'typescript', 'source')
        ],
        destination: 'tmp',
        whitelist: ['.mocharc.json$']
      });
      const dataString = fs.readFileSync((path.join('tmp', '.mocharc.json')), 'utf8');
      return expect(dataString).to.include('"recursive": true');
    });

    return it('applies the data transformation function to the files it will write', function() {
      const test = {
        transform(d) { return d; }
      };
      const transformSpy = spy(test, 'transform');

      filesHandler.syncDir({
        sourcePaths: [
          path.join('common', 'typescript', 'config'),
          path.join('bundled', 'typescript', 'config')
        ],
        destination: 'tmp',
        whitelist: ['.*\\.json$'],
        dataTransform: test.transform
      });

      return expect(transformSpy.callCount).to.equal(4);
    });
  });
});
