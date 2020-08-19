/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { assert, expect } from 'chai';
import Generator from '../../../../src/command-line/generators/generator';

describe('Generator', () => {
  let options = undefined;
  let logger = undefined;

  beforeEach(() => {
    options = {
      root: '.'
    };
    logger = {
      log() { return undefined; }
    };
  });

  describe('#constructor', () => it('assigns args appropriately', () => {
    const generator = new Generator({
      options,
      logger
    });

    assert(generator.hasOwnProperty('options'), 'created options on the object as a property');
    assert(generator.hasOwnProperty('logger'), 'created logger on the object as a property');

    expect(generator.options).to.deep.equal(options);
    expect(generator.logger).to.deep.equal(logger);
  }));

  describe('#_rootPath', () => it('extracts the root path from options', () => {
    const generator = new Generator({
      options,
      logger
    });
    expect(generator._rootPath()).to.equal('.');
  }));

  describe('#generate', () => {
    it('throws an error if you try to call generate directly', () => {
      const generator = new Generator({
        options,
        logger
      });

      expect(() => generator.generate()).to.throw('Generator#generate not implemented');
    });

    it('throws an error if a class that extended it does not implement #generate', () => {
      class MockGenerator extends Generator {
        static initClass() {
          this.description = 'Mock Generator';
        }
      }
      MockGenerator.initClass();

      const generator = new MockGenerator({
        options,
        logger
      });

      expect(() => generator.generate()).to.throw('MockGenerator#generate not implemented');
    });
  });
});
