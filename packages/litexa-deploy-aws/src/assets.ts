/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import AWS from 'aws-sdk';
import configureAWS from './aws-config';
import s3Utils from './utils/s3Utils';
import { IAWSContext, ILogger } from './types';

export function deploy(context: IAWSContext, logger: ILogger) {
  logger.log('deploying assets');
  const { skill } = context;
  const { projectInfo } = skill;

  configureAWS.handle(context, logger, AWS);

  context.assetDeploymentStart = new Date().getTime();

  const bucketName = context.deploymentOptions?.S3BucketName ? context.deploymentOptions?.S3BucketName : context.deploymentOptions?.s3Configuration?.bucketName;

  if (!bucketName) {
    throw new Error(`Found neither \`S3BucketName\` nor \`s3Configuration.bucketName\` in Litexa config for deployment target '${context.deploymentName}'. Please use either setting to specify a bucket to create (if necessary) and deploy to.`
    );
  }

  console.log(`bucketName = ${bucketName}`);
  s3Utils.validateS3BucketName(bucketName);

  const s3Context = {
    baseLocation: `${projectInfo.name}/${projectInfo.variant}`,
    assets: {},
    listPage: 0,
    bucketName,
    RESTRoot: '',
  };

  s3Utils.validateS3PathName(s3Context.baseLocation);

  const S3 = new AWS.S3({
    params: {
      Bucket: bucketName
    }
  });

  context.S3 = S3;

  const { region } = context.S3.config;
  s3Context.RESTRoot = `https://s3.${region}.amazonaws.com/${bucketName}`;
  if (context.deploymentOptions?.overrideAssetsRoot) {
    context.artifacts.save('assets-root', context.deploymentOptions.overrideAssetsRoot);
  } else {
    context.artifacts.save('assets-root', `${s3Context.RESTRoot}/${s3Context.baseLocation}/`);
  }

  const s3UtilArgs = {
    s3Context,
    skillContext: context,
    logger,
    startToken: '',
    md5Override: false
  };

  return s3Utils.prepareBucket(s3UtilArgs)
    .then(() => s3Utils.collectUploadInfo(s3UtilArgs))
    .then(() => s3Utils.listBucketAndUploadAssets(s3UtilArgs))
    .catch((err: string) => {
      logger.error(err);
      throw 'failed assets deployment';
    });
}

export default {
  deploy
};
