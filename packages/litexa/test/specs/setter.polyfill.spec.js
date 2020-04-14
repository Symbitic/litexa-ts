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

require('@src/setter.polyfill');
const {expect} = require('chai');

describe('@setter', () => it('allows me to use the @setter syntax to polyfill ES6 setter behavior', function() {
  const attribute = 'myAttribute';
  const value = 'expectedValue';

  class TestClass {
    static initClass() {
      this.setter(attribute, function(value) {
        return this.setAttribute = value;
      });
    }
  }
  TestClass.initClass();

  const testInstance = new TestClass();
  testInstance.myAttribute = value;
  return expect(testInstance.setAttribute).to.equal(value);
}));
