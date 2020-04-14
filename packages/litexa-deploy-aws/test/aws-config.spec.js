/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { assert, expect } from 'chai';
import { match, spy } from 'sinon';
import { deploymentTargetConfiguration } from './helpers';
import fs from 'fs';
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';
import AWS from 'aws-sdk';
import { handle } from '../src/aws-config';

describe('Setting up AWS credentials from aws-config', () => {
  let loggerInterface = undefined;
  let context = undefined;

  beforeEach(() => {
    loggerInterface = {
      log() {}
    };

    context = {
      deploymentName: 'development',
      projectConfig: {
        root: '.'
      },
      deploymentOptions: {
        awsProfile: 'testProfileThatDoesNotExist'
      }
    };
    fs.writeFileSync('aws-config.json', JSON.stringify(deploymentTargetConfiguration, undefined, 2), 'utf8');
    mkdirp.sync('.deploy');
  });

  afterEach(() => {
    rimraf.sync('.deploy');
    fs.unlinkSync('aws-config.json');
  });

  it('throws an error if it cannot find the specified deployment target in aws-config.json', () => {
    context.deploymentName = 'nonexistentTarget';
    const callAwsConfig = () => handle(context);
    expect(callAwsConfig).to.throw(`Failed to load aws-config.json: No AWS credentials exist for the \`${context.deploymentName}\` deployment target. See @litexa/deploy-aws/readme.md for details on your aws-config.json.`);
  });

  it('throws an error if there is no secretAccessKey in the target\'s aws config', () => {
    fs.unlinkSync('aws-config.json');
    const logSpy = spy(loggerInterface, 'log');
    const callAwsConfig = () => handle(context, loggerInterface, AWS);
    expect(callAwsConfig).to.throw(`Failed to load the AWS profile ${context.deploymentOptions.awsProfile}.`);
    assert(logSpy.neverCalledWith(match('loaded AWS config from aws-config.json')), 'indicated that it did not get credentials from aws-config.json');
    assert(logSpy.neverCalledWith(match('loaded AWS profile .*')), 'indicates it never loaded the AWS profile');
    fs.writeFileSync('aws-config.json', 'restore as dummy file for cleanup', 'utf8');
  });

  it('sets AWS config from file', () => {
    assert(!context.AWSConfig, 'context.AWSConfig does not exist before function call');
    assert(context.projectConfig, 'project config exists in the input');
    assert(context.deploymentName, 'deployment name exists in the input');
    assert(context.deploymentOptions, 'deployment options in input exists');
    handle(context, loggerInterface, AWS);
    assert(context.AWSConfig, 'context.AWSConfig was populated');
  });
});
