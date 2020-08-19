/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { assert, expect } from 'chai';
import validate from '../../../../../src/command-line/generators/validators/skillStoreTitleValidator';

describe('#skillStoreTitleValidate', () => {
  it('throws an error if it is empty', () => {
    const testFn = () => validate('');
    expect(testFn).to.throw('skill store title cannot be empty');
  });

  it('throws an error if it has special characters', () => {
    const testFn = () => validate('~!@#$%^&*()');
    expect(testFn).to.throw('invalid. You can use letters, numbers, the possessive apostrophe, spaces and hyphen or underscore character');
  });

  it('throws an error if it has any of the wake words', () => {
    // closure: a function that takes a word and returns a function to be tested that remembers that word on invocation
    const testFn = wakeWord => () => validate(`${wakeWord} other word`);

    expect(testFn('alexa')).to.throw('You cannot use any of these words');
    expect(testFn('computer')).to.throw('You cannot use any of these words');
    expect(testFn('amazon')).to.throw('You cannot use any of these words');
    expect(testFn('echo')).to.throw('You cannot use any of these words');
  });

  it('does not throw an error if there are any spaces', () => {
    const testFn = () => validate('this is invalid name');
    expect(testFn).to.not.throw();
  });

  it('does not throw for letters, numbers, apostrophe, hyphen or underscores', () => {
    const testFn = () => validate("th1s-n4m3's-fine");
    expect(testFn).to.not.throw();
  });
});
