/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { expect } from 'chai';
import render from '../../../../src/command-line/generators/searchReplace';

describe('#searchReplace', () => it('replaces the placeholders in the string data with the provided values', () => {
  const stringTemplate = 'Hi, my name is {name}, I am {age} years old. I am {sentiment} to meet you, very {sentiment}.';
  const templateValues = {
    name: 'Alexa',
    age: 4,
    sentiment: 'pleased'
  };

  const renderedString = render(stringTemplate, templateValues);
  const expectedResult = 'Hi, my name is Alexa, I am 4 years old. I am pleased to meet you, very pleased.';

  expect(renderedString).to.equal(expectedResult);
}));
