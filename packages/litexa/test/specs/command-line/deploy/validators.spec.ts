/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { expect } from 'chai';
import { fake, spy } from 'sinon';

const { validateCoreVersion } = require('@src/command-line/deploy/validators');

describe('Version validator', () => {
  let fakeInquirer: any = undefined;
  let promptSpy: any = undefined;

  beforeEach(() => {
    fakeInquirer = {
      prompt() { return fake.returns(Promise.resolve({ proceed: true })); }
    };
    promptSpy = spy(fakeInquirer, 'prompt');
  });

  it('detects mismatching major version', () => {
    // cur > prev
    validateCoreVersion({
      curCoreVersion: '0.2.0',
      prevCoreVersion: '0.1.0',
      inputHandler: fakeInquirer
    });

    expect(promptSpy.firstCall.args[0]).to.have.property(
      'message',
      `WARNING: This project was last deployed with version 0.1.0 of @litexa/core. A \
different minor version 0.2.0 is currently installed. Are you sure you want to proceed?`
    );

    // prev > cur
    validateCoreVersion({
      curCoreVersion: '0.1.0',
      prevCoreVersion: '0.2.0',
      inputHandler: fakeInquirer
    });

    return expect(promptSpy.secondCall.args[0]).to.have.property(
      'message',
      `WARNING: This project was last deployed with version 0.2.0 of @litexa/core. A \
different minor version 0.1.0 is currently installed. Are you sure you want to proceed?`
    );
  });

  it('detects mismatching minor version', () => {
    // cur > prev
    validateCoreVersion({
      curCoreVersion: '1.0.0',
      prevCoreVersion: '0.0.0',
      inputHandler: fakeInquirer
    });

    expect(promptSpy.firstCall.args[0]).to.have.property(
      'message',
      `WARNING: This project was last deployed with version 0.0.0 of @litexa/core. A \
different major version 1.0.0 is currently installed. Are you sure you want to proceed?`
    );

    // prev > cur
    validateCoreVersion({
      curCoreVersion: '0.1.0',
      prevCoreVersion: '1.0.0',
      inputHandler: fakeInquirer
    });

    expect(promptSpy.secondCall.args[0]).to.have.property(
      'message',
      `WARNING: This project was last deployed with version 1.0.0 of @litexa/core. A \
different major version 0.1.0 is currently installed. Are you sure you want to proceed?`
    );
  });

  it('ignores mismatching revision version', () => {
    validateCoreVersion({
      curCoreVersion: '0.0.1',
      prevCoreVersion: '0.0.2',
      inputHandler: fakeInquirer
    });

    expect(promptSpy.callCount).to.equal(0);
  });
});