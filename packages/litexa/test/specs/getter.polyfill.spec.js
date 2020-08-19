/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import '../../src/getter.polyfill';
import { expect } from 'chai';

describe('@getter', () => it('allows me to use the @getter syntax to polyfill ES6 getter behavior', () => {
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
