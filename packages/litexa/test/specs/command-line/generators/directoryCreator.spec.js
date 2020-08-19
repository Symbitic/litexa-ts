/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import DirectoryCreator from '../../../../src/command-line/generators/directoryCreator';
import InlinedStructureCreator from '../../../../src/command-line/generators/directory/inlinedStructureCreator';
import SeparateStructureCreator from '../../../../src/command-line/generators/directory/separateStructureCreator';
import BundlerStructureCreator from '../../../../src/command-line/generators/directory/bundlerStructureCreator';
import { expect } from 'chai';
import { MockTemplateFilesHandlerInterface } from '../../../helpers';

describe('DirectoryCreator', () => describe('#constructor', () => {
  let options = undefined;
  beforeEach(() => {
    const loggerInterface = {
      log() { return undefined; }
    };
    options = {
      bundlingStrategy: 'none',
      logger: loggerInterface,
      litexaDirectory: 'litexa',
      templateFilesHandlerClass: MockTemplateFilesHandlerInterface
    };
  });

  it('creates an inlined structure creator instance', () => {
    const creator = new DirectoryCreator(options);
    expect(creator).to.be.instanceOf(InlinedStructureCreator);
  });

  it('creates an separate structure creator instance', () => {
    options.bundlingStrategy = 'npm-link';
    const creator = new DirectoryCreator(options);
    expect(creator).to.be.instanceOf(SeparateStructureCreator);
  });

  it('creates an bundler structure creator instance', () => {
    options.bundlingStrategy = 'webpack';
    const creator = new DirectoryCreator(options);
    expect(creator).to.be.instanceOf(BundlerStructureCreator);
  });

  it('throws an error for an unsupported strategy', () => {
    options.bundlingStrategy = 'unsupported';
    expect(() => new DirectoryCreator(options)).to.throw();
  });
}));
