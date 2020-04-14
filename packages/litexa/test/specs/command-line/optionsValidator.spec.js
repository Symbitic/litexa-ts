/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const {assert, expect} = require('chai');
const validator = require('@src/command-line/optionsValidator');

describe('OptionsValidator', function() {
  let toValidate = undefined;

  beforeEach(() => toValidate = [{
    name: 'option',
    valid: [
      'yes',
      'no',
      'maybe'
    ],
    message: 'option has to be of value "yes", "no", or "maybe"'
  }]);

  it('returns an error', function() {
    const result = validator({ option: 'mybae' }, toValidate);
    return expect(result).to.deep.equal([{
      name: 'option',
      message: 'option has to be of value "yes", "no", or "maybe"'
    }]);
  });

  it('does not return an error', function() {
    const result = validator({ option: 'maybe' }, toValidate);
    return assert(result.length === 0, 'it does not return any errors');
  });

  it('does not remove invalid option from object', function() {
    const options = { option: 'mybae' };
    validator(options, toValidate);
    return expect(options).to.deep.equal({ option: 'mybae' });
  });

  it('does removes invalid option from object', function() {
    const options = { option: 'mybae' };
    validator(options, toValidate, true);
    return expect(options).to.deep.equal({});
  });

  return it('accepts empty options', function() {
    const result = validator({}, toValidate);
    return assert(result.length === 0, 'it does not return any errors');
  });
});
