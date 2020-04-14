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

require('@src/getter.polyfill');
const {expect} = require('chai');

describe('@getter', () => it('allows me to use the @getter syntax to polyfill ES6 getter behavior', function() {
  const attribute = 'myAttribute';
  const value = 'expectedValue';

  class TestClass {
    static initClass() {
      this.getter(attribute, () => value);
    }
  }
  TestClass.initClass();

  const testInstance = new TestClass();
  return expect(testInstance.myAttribute).to.equal(value);
}));
