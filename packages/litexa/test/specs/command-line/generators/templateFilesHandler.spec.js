/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { assert, expect } from 'chai';
import { match, spy, stub } from 'sinon';

import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { sync } from 'rimraf';
import { sync as _sync } from 'mkdirp';

import TemplateFilesHandler from '../../../../src/command-line/generators/templateFilesHandler';

describe('TemplateFilesHandler', () => {
  const tmpDir = 'tmp';
  let loggerInterface = undefined;
  let filesHandler = undefined;

  beforeEach(() => {
    loggerInterface = {
      log() { return undefined; }
    };
    filesHandler = new TemplateFilesHandler({
      logger: loggerInterface
    });
    _sync(tmpDir);
  });

  afterEach(function() {
    if (existsSync(tmpDir)) {
      sync(tmpDir);
    }
  });

  describe('#syncDir', () => {
    it("doesn't write any files if no whitelist is provided", () => {
      filesHandler.syncDir({
        sourcePaths: [join('common', 'litexa')],
        destination: 'tmp'
      });
      assert(!existsSync(join('tmp', 'main.litexa')),
        "main file did not get created because it wasn't whitelisted");
      assert(!existsSync(join('tmp', 'main.test.litexa')),
        "main test file did not get created because it wasn't whitelisted");
    });

    it('only writes the files that are whitelisted', () => {
      filesHandler.syncDir({
        sourcePaths: [join('common', 'litexa')],
        destination: 'tmp',
        whitelist: ['main.litexa$']
      });
      assert(existsSync(join('tmp', 'main.litexa')), 'main file was created');
      assert(!existsSync(join('tmp', 'main.test.litexa')),
        "main test file did not get created because it wasn't whitelisted");
    });

    it('applies each whitelist regex', () => {
      filesHandler.syncDir({
        sourcePaths: [join('common', 'litexa')],
        destination: 'tmp',
        whitelist: [
          'main.litexa$',
          'main.test.litexa$'
        ]
      });
      assert(existsSync(join('tmp', 'main.litexa')), 'main file was created');
      assert(existsSync(join('tmp', 'main.test.litexa')), 'main test file created');
    });

    it('reads from multiple directories and cascades files based on order', () => {
      filesHandler.syncDir({
        sourcePaths: [
          join('common', 'typescript', 'source'),
          join('bundled', 'typescript', 'source')
        ],
        destination: 'tmp',
        whitelist: ['.mocharc.json$']
      });
      const dataString = readFileSync((join('tmp', '.mocharc.json')), 'utf8');
      expect(dataString).to.include('"recursive": true');
    });

    it('applies the data transformation function to the files it will write', () => {
      const test = {
        transform(d) { return d; }
      };
      const transformSpy = spy(test, 'transform');

      filesHandler.syncDir({
        sourcePaths: [
          join('common', 'typescript', 'config'),
          join('bundled', 'typescript', 'config')
        ],
        destination: 'tmp',
        whitelist: ['.*\\.json$'],
        dataTransform: test.transform
      });

      expect(transformSpy.callCount).to.equal(4);
    });
  });
});
