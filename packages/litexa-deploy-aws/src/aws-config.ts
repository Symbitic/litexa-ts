/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import fs from 'fs';
import path from 'path';
import { IAWSContext, ILogger } from './types';

export function handle(context: IAWSContext, logger: ILogger, AWS): void {
  let credentials;
  let config;

  const jsonCredentialsFile = path.join(context.projectConfig.root, 'aws-config.json');
  try {
    require('./local-cache').loadCache(context);
  } catch (error) {}
  // it's ok for now, not everyone caches

  try {
    if (fs.existsSync(jsonCredentialsFile)) {
      credentials = JSON.parse(fs.readFileSync(jsonCredentialsFile, 'utf-8'));
      credentials = credentials[context.deploymentName];
      if (!credentials) {
        throw `No AWS credentials exist for the \`${context.deploymentName}\` deployment target. See @litexa/deploy-aws/readme.md for details on your aws-config.json.`;
      }
      config = new AWS.Config(credentials);
      logger.log(`loaded AWS config from ${jsonCredentialsFile}`);
    }
  } catch (err) {
    throw `Failed to load ${jsonCredentialsFile}: ${err}`;
  }

  if (!config) {
    const profile = context.deploymentOptions.awsProfile || 'default';
    credentials = new AWS.SharedIniFileCredentials({
      profile
    });

    if (!credentials.secretAccessKey) {
      throw `Failed to load the AWS profile ${profile}. You need to ensure that the aws-cli works with that profile before you can try again. Alternatively, you may want to add a local authorization with a aws-config.json file? See @litexa/deploy-aws/readme.md for details.`;
    }

    config = new AWS.Config();
    config.credentials = credentials;
    if (!config.region) {
      config.region = 'us-east-1';
    }

    logger.log(`loaded AWS profile ${profile}`);
  }

  AWS.config = config;
  context.AWSConfig = config;
}

export default {
  handle
};
