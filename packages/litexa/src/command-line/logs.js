/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const path = require('path');
const mkdirp = require('mkdirp');
const LoggingChannel = require('./loggingChannel');
const config = require('./project-config');
const ProjectInfo = require('./project-info');
const deploymentModule = require('../deployment/deployment-module');

async function run(options) {
  const logger = new LoggingChannel({
    logStream: options.logger ? options.logger : console,
    logPrefix: 'logs',
    verbose: options.verbose
  });

  logger.important('Beginning log pull');

  options.projectConfig = await config.loadConfig(options.root);
  options.projectInfo = new ProjectInfo({ jsonConfig: options.projectConfig, variant: options.deployment });

  options.logsRoot = path.join(options.projectConfig.root, '.logs');
  mkdirp.sync(options.logsRoot);

  logger.log(`logs root at ${options.logsRoot}`);

  if (!('deployments' in options.projectInfo)) {
    throw new Error(`missing \`deployments\` key in the Litexa config file, can't continue without parameters to pass to the deployment module!`);
  }

  options.deployment = options.deployment ? options.deployment : 'development';
  const deploymentOptions = options.projectInfo.deployments[options.deployment];
  options.deploymentName = options.deployment;
  options.projectRoot = options.projectConfig.root;
  options.deploymentOptions = deploymentOptions;
  if (!deploymentOptions) {
    throw new Error(`couldn't find a deployment called \`${options.deployment}\` in the deployments section of the Litexa config file, cannot continue.`);
  }

  const deployModule = deploymentModule(options.projectConfig.root, deploymentOptions, logger);

  try {
    await deployModule.logs.pull(options, logger);
    logger.important('done pulling logs');
  } catch (err) {
    logger.important(error);
  }
}

module.exports = {
  run
};
