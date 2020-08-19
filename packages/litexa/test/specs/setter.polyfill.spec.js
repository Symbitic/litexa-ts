/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import '../../src/setter.polyfill';
import { expect } from 'chai';

describe('@setter', () => it('allows me to use the @setter syntax to polyfill ES6 setter behavior', () => {
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
