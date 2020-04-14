/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const {assert, expect} = require('chai');

const validate = require('@src/command-line/generators/validators/skillStoreTitleValidator');

describe('#skillStoreTitleValidate', function() {
  it('throws an error if it is empty', function() {
    const testFn = () => validate('');
    return expect(testFn).to.throw('skill store title cannot be empty');
  });

  it('throws an error if it has special characters', function() {
    const testFn = () => validate('~!@#$%^&*()');
    return expect(testFn).to.throw('invalid. You can use letters, numbers, the possessive apostrophe, spaces and hyphen or underscore character');
  });

  it('throws an error if it has any of the wake words', function() {
    // closure: a function that takes a word and returns a function to be tested that remembers that word on invocation
    const testFn = wakeWord => () => validate(`${wakeWord} other word`);

    expect(testFn('alexa')).to.throw('You cannot use any of these words');
    expect(testFn('computer')).to.throw('You cannot use any of these words');
    expect(testFn('amazon')).to.throw('You cannot use any of these words');
    return expect(testFn('echo')).to.throw('You cannot use any of these words');
  });

  it('does not throw an error if there are any spaces', function() {
    const testFn = () => validate('this is invalid name');
    return expect(testFn).to.not.throw();
  });

  return it('does not throw for letters, numbers, apostrophe, hyphen or underscores', function() {
    const testFn = () => validate("th1s-n4m3's-fine");
    return expect(testFn).to.not.throw();
  });
});
