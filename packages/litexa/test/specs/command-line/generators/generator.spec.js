/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const {assert, expect} = require('chai');

const Generator = require('@src/command-line/generators/generator');

describe('Generator', function() {
  let options = undefined;
  let logger = undefined;

  beforeEach(function() {
    options = {
      root: '.'
    };
    return logger = {
      log() { return undefined; }
    };});

  describe('#constructor', () => it('assigns args appropriately', function() {
    const generator = new Generator({
      options,
      logger
    });

    assert(generator.hasOwnProperty('options'), 'created options on the object as a property');
    assert(generator.hasOwnProperty('logger'), 'created logger on the object as a property');

    expect(generator.options).to.deep.equal(options);
    return expect(generator.logger).to.deep.equal(logger);
  }));

  describe('#_rootPath', () => it('extracts the root path from options', function() {
    const generator = new Generator({
      options,
      logger
    });
    return expect(generator._rootPath()).to.equal('.');
  }));

  return describe('#generate', function() {
    it('throws an error if you try to call generate directly', function() {
      const generator = new Generator({
        options,
        logger
      });

      return expect(() => generator.generate()).to.throw('Generator#generate not implemented');
    });

    return it('throws an error if a class that extended it does not implement #generate', function() {
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

      return expect(() => generator.generate()).to.throw('MockGenerator#generate not implemented');
    });
  });
});
