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

const Test = require('@test/helpers');

const DirectoryCreator = require('@src/command-line/generators/directoryCreator');
const InlinedStructureCreator = require('@src/command-line/generators/directory/inlinedStructureCreator');
const SeparateStructureCreator = require('@src/command-line/generators/directory/separateStructureCreator');
const BundlerStructureCreator = require('@src/command-line/generators/directory/bundlerStructureCreator');

describe('DirectoryCreator', () => describe('#constructor', function() {
  let options = undefined;
  beforeEach(function() {
    const loggerInterface = {
      log() { return undefined; }
    };
    return options = {
      bundlingStrategy: 'none',
      logger: loggerInterface,
      litexaDirectory: 'litexa',
      templateFilesHandlerClass: Test.MockTemplateFilesHandlerInterface
    };});

  it('creates an inlined structure creator instance', function() {
    const creator = new DirectoryCreator(options);
    return expect(creator).to.be.instanceOf(InlinedStructureCreator);
  });

  it('creates an separate structure creator instance', function() {
    options.bundlingStrategy = 'npm-link';
    const creator = new DirectoryCreator(options);
    return expect(creator).to.be.instanceOf(SeparateStructureCreator);
  });

  it('creates an bundler structure creator instance', function() {
    options.bundlingStrategy = 'webpack';
    const creator = new DirectoryCreator(options);
    return expect(creator).to.be.instanceOf(BundlerStructureCreator);
  });

  return it('throws an error for an unsupported strategy', function() {
    options.bundlingStrategy = 'unsupported';
    return expect(() => new DirectoryCreator(options)).to.throw();
  });
}));
