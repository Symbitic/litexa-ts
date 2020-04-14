/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';
import Manifest from '@litexa/core/src/command-line/deploy/manifest';
import { defaultManifest } from './helpers';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { match, spy } from 'sinon';

chai.use(chaiAsPromised);
const { assert, expect } = chai;

describe('construct and deploy artifacts for manifest', function() {
  let loggerInterface = undefined;
  let context = undefined;
  let sampleArtifacts = undefined;
  let errorThrown = undefined;

  beforeEach(function() {
    loggerInterface = {
      log() {},
      error() {},
      warning() {},
      verbose() {},
      derive() {}
    };
    context = {
      // manifest uses require() and it doesn't work in test execution with relative paths
      projectRoot: path.join(process.cwd(), '.manifest-test'),
      artifacts: {
        get() {},
        save() {}
      },
      deploymentName: "test",
      deploymentOptions: {
        askProfile: "askProfile",
        invocation: {
          "en-US": "alternate name"
        },
        invocationSuffix: "suffix"
      },
      deployRoot: ".manifest-test/.deploy/test",
      projectInfo: {
        variant: "test",
        extensions: {
          testExtension: {
            manifestValidator() {},
            modelValidator() {}
          }
        },
        name: "project name"
      },
      skill: {
        collectRequiredAPIs() {},
        toModelV2() {}
      }
    };
    sampleArtifacts = {
      lambdaARN: "dummyLambdaARN",
      'deployedIconAssets': {
        'default': {
          'icon-108.png': {
            'url': 'dummyUrl'
          },
          'icon-512.png': {
            'url': 'dummyUrl'
          }
        }
      }
    };
    errorThrown = false;
    mkdirp.sync('.manifest-test');
    mkdirp.sync(context.deployRoot);
  });

  afterEach(function() {
    delete require.cache[require.resolve(path.join(context.projectRoot, 'skill.coffee'))];
    if (fs.existsSync('./.manifest-test/skill.coffee')) {
      fs.unlinkSync('./.manifest-test/skill.coffee');
    }
    rimraf.sync('.manifest-test');
  });

  const validArtifacts = name => sampleArtifacts[name];

  /*
  it('does not find a skill file and generates a default', async function() {
    let e, errorThrown;
    try {
      await Manifest.deploy(context, loggerInterface);
    } catch (error) {
      errorThrown = true;
      assert(error != null, 'exception was thrown');
      //assert.include(e, "skill.* was not found in project root", 'missing skill.* thrown');
      // Failed to parse skill manifest /home/alex/Projects/alexa/litexa/packages/litexa-deploy-aws/.manifest-test/skill
      //console.log('Here:')
      //console.log(e)
    }
    assert(errorThrown, 'an exception was thrown');
    assert(fs.existsSync(path.join(context.projectRoot, 'skill.coffee')), 'it generated a default skill.coffee');
    const generatedManifest = require('../.manifest-test/skill');
    assert.equal(generatedManifest.manifest.publishingInformation.locales['en-US'].name, "Project Name");
  });
  */

  it('loads an invalid skill file - missing `manifest`', async function() {
    const logSpy = spy(loggerInterface, 'log');
    const errorSpy = spy(loggerInterface, 'error');
    fs.writeFileSync("./.manifest-test/skill.coffee", 'module.exports = {foo:"bar"}', 'utf8');
    const dummy = () => undefined;
    try {
      await Manifest.deploy(context, loggerInterface);
    } catch (e) {
      errorThrown = true;
      assert((e != null), 'exception was thrown');
      assert.equal(e, "failed manifest deployment");
    }
    assert(errorThrown, 'an exception was thrown');
    assert(logSpy.calledWith(match("building skill manifest")), 'it loaded skill info');
    return assert(errorSpy.calledWith(match("Didn't find a 'manifest' property")),
      'manifest file missing `manifest` field');
  });

  it('loads an invalid skill file - missing `lambdaARN`', async function() {
    const logSpy = spy(loggerInterface, 'log');
    const errorSpy = spy(loggerInterface, 'error');
    fs.writeFileSync("./.manifest-test/skill.coffee", 'module.exports = {manifest:"bar"}', 'utf8');

    try {
      await Manifest.deploy(context, loggerInterface);
    } catch (e) {
      errorThrown = true;
      assert((e != null), 'exception was thrown');
      assert.equal(e, "failed manifest deployment");
    }
    assert(errorThrown, 'an exception was thrown');
    assert(logSpy.calledWith(match("building skill manifest")), 'it loaded skill info');
    return assert(errorSpy.calledWith(match("Missing lambda ARN")), 'artifacts file missing `lambdaARN` field');
  });

  it('writes a skill.json, uses variant in name and alternate invocation from deployment options', async function() {
    context.artifacts.get = validArtifacts;
    delete context.deploymentOptions.invocationSuffix;
    delete context.deploymentOptions.askProfile;
    const errorSpy = spy(loggerInterface, 'error');

    fs.writeFileSync("./.manifest-test/skill.coffee", defaultManifest, 'utf8');
    try {
      await Manifest.deploy(context, loggerInterface);
    } catch (error) {
      errorThrown = true;
      assert(errorSpy.calledWith(match("missing an ASK profile")), 'execution stopped at calling SMAPI');
    }
    assert(errorThrown, 'an exception was thrown');
    assert(fs.existsSync(path.join(context.deployRoot,'skill.json'), 'manifest file was written'));
    const writtenManifest = JSON.parse(fs.readFileSync(path.join(context.deployRoot,'skill.json')));
    assert(writtenManifest.manifest.publishingInformation.locales.hasOwnProperty('en-US'), 'there is a en-US locale');
    assert(writtenManifest.manifest.publishingInformation.locales.hasOwnProperty('en-GB'), 'there is a en-GB locale');
    expect(writtenManifest.manifest.publishingInformation.locales['en-US'].name).to.include('(test)');
    expect(writtenManifest.manifest.publishingInformation.locales['en-GB'].name).to.include('(test)');
    expect(writtenManifest.manifest.publishingInformation.locales['en-US'].examplePhrases[0]).to.include('alternate name');
    return expect(writtenManifest.manifest.publishingInformation.locales['en-GB'].examplePhrases[0]).to.not.include('alternate name');
  });

  it('applies suffix from deploymentOptions regardless of alternate invocation', async function() {
    context.artifacts.get = validArtifacts;
    delete context.deploymentOptions.askProfile;
    const errorSpy = spy(loggerInterface, 'error');

    fs.writeFileSync("./.manifest-test/skill.coffee", defaultManifest, 'utf8');
    try {
      await Manifest.deploy(context, loggerInterface);
    } catch (error) {
      errorThrown = true;
      assert(errorSpy.calledWith(match("missing an ASK profile")), 'execution stopped at calling SMAPI');
    }
    assert(errorThrown, 'an exception was thrown');
    assert(fs.existsSync(path.join(context.deployRoot,'skill.json'), 'manifest file was written'));
    const writtenManifest = JSON.parse(fs.readFileSync(path.join(context.deployRoot,'skill.json')));
    expect(writtenManifest.manifest.publishingInformation.locales['en-US'].examplePhrases[0]).to.include('alternate name suffix');
    expect(writtenManifest.manifest.publishingInformation.locales['en-GB'].examplePhrases[0]).to.not.include('alternate name');
    return expect(writtenManifest.manifest.publishingInformation.locales['en-GB'].examplePhrases[0]).to.include('suffix');
  });

  return it('does not apply `(variant)` to skill name if deployment target is `production`', async function() {
    context.artifacts.get = validArtifacts;
    delete context.deploymentOptions.askProfile;
    context.projectInfo.variant = 'production';
    const errorSpy = spy(loggerInterface, 'error');

    fs.writeFileSync("./.manifest-test/skill.coffee", defaultManifest, 'utf8');
    try {
      await Manifest.deploy(context, loggerInterface);
    } catch (error) {
      errorThrown = true;
      assert(errorSpy.calledWith(match("missing an ASK profile")), 'execution stopped at calling SMAPI');
    }
    assert(errorThrown, 'an exception was thrown');
    assert(fs.existsSync(path.join(context.deployRoot,'skill.json'), 'manifest file was written'));
    const writtenManifest = JSON.parse(fs.readFileSync(path.join(context.deployRoot,'skill.json')));
    expect(writtenManifest.manifest.publishingInformation.locales['en-GB'].examplePhrases[0]).to.not.include('(');
    return expect(writtenManifest.manifest.publishingInformation.locales['en-GB'].examplePhrases[0]).to.not.include('(');
  });
});
