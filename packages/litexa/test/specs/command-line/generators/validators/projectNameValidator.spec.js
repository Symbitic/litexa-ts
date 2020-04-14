/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const {assert, expect} = require('chai');

const validate = require('@src/command-line/generators/validators/projectNameValidator');

describe('#projectNameValidate', function() {
  it('throws an error if a project name is less than 5 characters', function() {
    const testFn = () => validate('1234');
    return expect(testFn).to.throw('should be at least 5 characters');
  });

  it('throws an error if it has special characters', function() {
    const testFn = () => validate('~!@#$%^&*()');
    return expect(testFn).to.throw('invalid. You can use letters, numbers, hyphen or underscore characters');
  });

  it('throws an error if there are any spaces', function() {
    const testFn = () => validate('this is an invalid name');
    return expect(testFn).to.throw("The character ' ' is invalid.");
  });

  it('does not throw for letters, numbers, hyphen or underscores', function() {
    const testFn = () => validate("th1s-n4m3s_fine");
    return expect(testFn).to.not.throw();
  });

  return it('does not allow backslash and single quotes', function() {
    const testFn = () => validate("Luis'sErroneousProjectName\\");
    return expect(testFn).to.throw('invalid. You can use letters, numbers, hyphen or underscore characters');
  });
});
