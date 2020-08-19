/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { assert, expect } from 'chai';
import validator from '../../../src/command-line/optionsValidator';

describe('OptionsValidator', () => {
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

  it('returns an error', () => {
    const result = validator({ option: 'mybae' }, toValidate);
    expect(result).to.deep.equal([{
      name: 'option',
      message: 'option has to be of value "yes", "no", or "maybe"'
    }]);
  });

  it('does not return an error', () => {
    const result = validator({ option: 'maybe' }, toValidate);
    assert(result.length === 0, 'it does not return any errors');
  });

  it('does not remove invalid option from object', () => {
    const options = { option: 'mybae' };
    validator(options, toValidate);
    expect(options).to.deep.equal({ option: 'mybae' });
  });

  it('does removes invalid option from object', () => {
    const options = { option: 'mybae' };
    validator(options, toValidate, true);
    expect(options).to.deep.equal({});
  });

  it('accepts empty options', () => {
    const result = validator({}, toValidate);
    assert(result.length === 0, 'it does not return any errors');
  });
});
