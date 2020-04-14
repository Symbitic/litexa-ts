/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { expect } from 'chai';
import sinon from 'sinon';
import AWS from 'aws-sdk';
import assetsHandler from '../src/assets';
import awsConfigHandler from '../src/aws-config';
import s3Utils from '../src/utils/s3Utils';

describe('Upload Assets', () => {
  let logger = undefined;
  let context = undefined;

  let awsS3Stub = undefined;
  let awsConfigHandleStub = undefined;
  let collectUploadInfoStub = undefined;
  let listBucketAndUploadAssetsStub = undefined;
  let prepareBucketStub = undefined;
  let validateS3BucketNameStub = undefined;
  let validateS3PathNameStub = undefined;

  beforeEach(() => {
    logger = {
      log() {},
      error() {}
    };

    context = {
      projectConfig: {
        root: 'myProjectRoot'
      },
      skill: {
        projectInfo: {
          name: 'myProjectName',
          variant: 'myProjectVariant'
        }
      },
      deploymentName: 'myDeploymentName',
      deploymentOptions: {
        awsProfile: 'myAwsProfile',
        s3Configuration: {
          bucketName: 'mybucketname'
        }
      },
      artifacts: {
        save() {}
      }
    };

    awsS3Stub = sinon.stub(AWS, 'S3').returns({ config: { region: undefined } });
    awsConfigHandleStub = sinon.stub(awsConfigHandler, 'handle').returns(undefined);
    collectUploadInfoStub = sinon.stub(s3Utils, 'collectUploadInfo').returns(undefined);
    listBucketAndUploadAssetsStub = sinon.stub(s3Utils, 'listBucketAndUploadAssets').returns(undefined);
    //prepareBucketStub = sinon.stub(s3Utils, 'prepareBucket').returns({ then() { return { then() { return { catch() {} }; } }; } });
    prepareBucketStub = sinon.stub(s3Utils, 'prepareBucket').returns(Promise.resolve());
    validateS3BucketNameStub = sinon.stub(s3Utils, 'validateS3BucketName').returns(undefined);
    validateS3PathNameStub = sinon.stub(s3Utils, 'validateS3PathName').returns(undefined);
  });

  afterEach(() => {
    awsS3Stub.restore();
    awsConfigHandleStub.restore();
    collectUploadInfoStub.restore();
    listBucketAndUploadAssetsStub.restore();
    prepareBucketStub.restore();
    validateS3BucketNameStub.restore();
    validateS3PathNameStub.restore();
  });

  it('throws an error if neither S3BucketName nor s3Configuration.bucketName are given', () => {
    delete context.deploymentOptions.s3Configuration;
    const callDeploy = () => assetsHandler.deploy(context, logger);
    expect(callDeploy).to.throw(`Found neither \`S3BucketName\` nor \`s3Configuration.bucketName\` in Litexa config for deployment target 'myDeploymentName'. Please use either setting to specify a bucket to create (if necessary) and deploy to.`);
  });

  it('should pass basic inspection', () => {
    assetsHandler.deploy(context, logger)
  })
});
