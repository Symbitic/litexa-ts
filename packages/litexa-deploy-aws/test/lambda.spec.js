/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { assert, expect } from 'chai';
import { match, spy } from 'sinon';
import { lambdaTriggerStatement } from './helpers';
import { unitTestHelper } from '../src/lambda';

import fs from 'fs';
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';

describe('Running Deploy to Lambda', function() {
  let loggerInterface = undefined;
  let context = undefined;
  let lambdaContext = undefined;

  beforeEach(function() {
    loggerInterface = {
      log() { return undefined; },
      error() { return undefined; },
      verbose() { return undefined; },
      warning() { return undefined; }
    };

    context = {
      deploymentName: 'development',
      projectRoot: '.',
      localCache: {
        millisecondsSince() { return 1000; },
        timestampExists() { return false; },
        saveTimestamp() {  }
      },
      skill: { projectInfo: { litexaRoot: 'test/sample'} },
      projectConfig: {
        root: '.'
      },
      deploymentOptions: {
        awsProfile: 'testProfileThatDoesNotExist'
      },
      deployRoot: 'test/sample'
    };

    lambdaContext = {
      codeRoot: 'test/sample',
      litexaRoot: '../../../litexa'
    };
    try {
      mkdirp.sync('test/sample/node_modules');
      mkdirp.sync('test/sample/lambda');
      return fs.closeSync(fs.openSync('test/sample/node_modules/test.txt', 'w'));
    } catch (error) {}
  });

  afterEach(function() {
    if (fs.existsSync('test/sample')) { return rimraf.sync('test/sample'); }
  });

  describe('Checking function copyNodeModules', function() {
    describe('Testing Windows compatability', function() {});

    beforeEach(function() {
      this.originalPlatform = process.platform;
      return Object.defineProperty(process, 'platform', {value: 'win32'});});

    afterEach(function() {
      return Object.defineProperty(process, 'platform', {value: this.originalPlatform});});

    return it('does nothing because no updates are necessary', function() {
      context.localCache.millisecondsSince = () => 0;
      return unitTestHelper('copyNodeModules', context, loggerInterface, lambdaContext)
      .then(result => expect(result).to.be.undefined)
      .catch(error => undefined);
    });
  });

  describe('Checking function packZipFile', function() {
    describe('Testing Windows compatability', function() {});

    beforeEach(function() {
      this.originalPlatform = process.platform;
      return Object.defineProperty(process, 'platform', {value: 'win32'});});

    afterEach(function() {
      return Object.defineProperty(process, 'platform', {value: this.originalPlatform});});

    return it('creates a zip file with no errors', function() {
      context.localCache.millisecondsSince = () => 0;
      return unitTestHelper('packZipFile', context, loggerInterface, lambdaContext)
      .then(result => expect(result).to.be.undefined)
      .catch(error => undefined);
    });
  });

  return describe('Checking function checkLambdaPermissions', function() {

    beforeEach(function() {
      const artifacts = {
        get() { return lambdaTriggerStatement.Resource; }
      };
      return context.artifacts = artifacts;
    });

    it('does not add a policy if it finds the alexa trigger policy already attached', async function() {
      const getPolicyPromise = resolve => resolve({Policy: `{\"Statement\": [${JSON.stringify(lambdaTriggerStatement)}]}`});
      const awsLambda = {
        getPolicy() { return {
            promise() { return new Promise(getPolicyPromise); }
          }; },
        removePermission() { return new Promise(); }
      };

      const logSpy = spy(loggerInterface, 'log');
      lambdaContext.lambda = awsLambda;
      await unitTestHelper('checkLambdaPermissions', context, loggerInterface, lambdaContext);
      assert(logSpy.calledWith(match("reconciling policies against existing data")), 'getPolicy returned data');
      return assert(logSpy.withArgs(match("removing policy")).notCalled, 'no policies were removed');
    });

    it('warns when assets root is not set in the deployed lambda environment config', async function() {
      const logSpy = spy(loggerInterface, 'warning');
      await unitTestHelper('checkForAssetsRoot', context, loggerInterface, lambdaContext);
      return assert(logSpy.withArgs(match("Assets root is not set")), 'assets root is not set');
    });

    it('adds a policy if no policy exists', async function() {
      const getPolicyPromise = function(resolve) {
        throw {
          code: "ResourceNotFoundException"
        };
      };
      const addPolicyPromise = resolve => resolve("Permission added");
      const awsLambda = {
        getPolicy() { return {
            promise() { return new Promise(getPolicyPromise); }
          }; },
        removePermission() { return new Promise(); },
        addPermission() { return {
            promise() { return new Promise(addPolicyPromise); }
          }; }
      };

      const logSpy = spy(loggerInterface, 'log');
      const verboseSpy = spy(loggerInterface, 'verbose');
      lambdaContext.lambda = awsLambda;
      await unitTestHelper('checkLambdaPermissions', context, loggerInterface, lambdaContext);
      assert(logSpy.withArgs(match("reconciling policies")).notCalled, 'there were no existing policies');
      assert(logSpy.calledWith(match("adding policies to Lambda")), 'added policy to Lambda');
      return assert(verboseSpy.calledWith(match("addPermission: \"Permission added\"")), 'added a permission');
    });

    return it('adds a policy and removes the old one if there is a mismatch on expected fields', async function() {
      const getPolicyPromise = function(resolve) {
        const modifiedLambdaStatement = JSON.parse(JSON.stringify(lambdaTriggerStatement));
        modifiedLambdaStatement.Resource = "";
        return resolve({Policy: `{\"Statement\": [${JSON.stringify(modifiedLambdaStatement)}]}`});
      };
      const addPolicyPromise = resolve => resolve("Permission added");
      const awsLambda = {
        getPolicy() { return {
            promise() { return new Promise(getPolicyPromise); }
          }; },
        removePermission() { return {
            promise() { return new Promise(resolve => resolve()); }
          }; },
        addPermission() { return {
            promise() { return new Promise(addPolicyPromise); }
          }; }
      };

      const logSpy = spy(loggerInterface, 'log');
      const verboseSpy = spy(loggerInterface, 'verbose');
      lambdaContext.lambda = awsLambda;
      await unitTestHelper('checkLambdaPermissions', context, loggerInterface, lambdaContext);
      assert(logSpy.calledWith(match("reconciling policies against existing data")), 'getPolicy returned data');
      assert(logSpy.calledWith(match("removing policy")), 'removed old policy');
      return assert(verboseSpy.calledWith(match("addPermission: \"Permission added\"")), 'added a permission');
    });
  });
});
