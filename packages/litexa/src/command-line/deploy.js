/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { sync } from 'mkdirp';
import { join } from 'path';
import LoggingChannel from './loggingChannel';
import { build } from './skill-builder';
import deploymentModule from '../deployment/deployment-module';
import deploymentManifest from './deploy/manifest';
import { JSONValidator } from '../parser/jsonValidator';
import { loadArtifacts } from '../deployment/artifacts';
import { getCurrentState } from '../deployment/git';
import { convertAssets } from '../deployment/assets';
import { formatLocationStart } from '../parser/errors';
import { validateCoreVersion } from './deploy/validators';

function parseDeploymentTypes(options) {
  const optionTypes = options.type.split(',').map(d => d.trim());

  const deploymentTypes = {
    lambda: false,
    assets: false,
    model: false,
    manifest: false
  };

  for (let type of optionTypes) {
    if (!(type in deploymentTypes) && (type !== 'all')) {
      throw new Error(`Unrecognized deployment type \`${type}\``);
    }
  }

  const deployAll = optionTypes.includes('all');

  for (let key in deploymentTypes) {
    deploymentTypes[key] = optionTypes.includes(key) || deployAll;
  }

  return deploymentTypes;
};

export async function run(options) {
  let context, deploymentStartTime, deploymentTypes, deployModule, deployRoot, skill;
  const logStream = options.logger ? options.logger : console;
  const verbose = options.verbose ? options.verbose : false;

  const logger = new LoggingChannel({
    logPrefix: 'deploy',
    logStream,
    verbose
  });

  try {
    deploymentStartTime = new Date;

    // ok, load skill
    skill = await build(options.root, options.deployment);
    options.deployment = options.deployment ? options.deployment : 'development';
    skill.projectInfo.variant = options.deployment;

    // deployment artifacts live in this temp directory
    deployRoot = join(skill.projectInfo.root, '.deploy', skill.projectInfo.variant);
    sync(deployRoot);

    logger.filename = join(deployRoot, 'deploy.log');

    // couldn't log this until now, but it's close enough
    logger.log(`skill build complete in ${(new Date) - deploymentStartTime}ms`);

    logger.important(`beginning deployment of ${skill.projectInfo.root}`);

    // deploy what?
    deploymentTypes = parseDeploymentTypes(options);

    if (!('deployments' in skill.projectInfo)) {
      throw new Error(`missing 'deployments' key in the Litexa config file, can't continue without parameters to pass to the deployment module!`
      );
    }

    const deploymentOptions = skill.projectInfo.deployments[options.deployment];

    if (!deploymentOptions) {
      throw new Error(`couldn't find a deployment called \`${options.deployment}\` in the deployments section of the Litexa config file, cannot continue.`);
    }

    deployModule = deploymentModule(skill.projectInfo.root, deploymentOptions, logger);
    deployModule.manifest = deploymentManifest;

    // the context gets passed between the steps, to
    // collect shared information
    context = {
      skill,
      projectInfo: skill.projectInfo,
      projectConfig: skill.projectInfo,
      deployRoot,
      projectRoot: (skill.projectInfo != null ? skill.projectInfo.root : undefined),
      sharedDeployRoot: join(skill.projectInfo.root, '.deploy'),
      cache: options.cache,
      deploymentName: options.deployment,
      deploymentOptions: skill.projectInfo.deployments[options.deployment],
      JSONValidator
    };

  } catch (error) {
    const err = error;
    logger.error(err.message != null ? err.message : err);
    return;
  }

  try {
    await loadArtifacts({ context, logger });

    const lastDeploymentInfo = context.artifacts.get('lastDeployment');
    const proceed = await validateCoreVersion({
      prevCoreVersion: (lastDeploymentInfo != null ? lastDeploymentInfo.coreVersion : undefined),
      curCoreVersion: options.coreVersion
    });
    if (!proceed) {
      logger.log("canceled deployment");
      process.exit(0);
    }

    const info = await getCurrentState();

    await context.artifacts.save('lastDeployment', {
      date: new Date().toLocaleString(),
      deploymentTypes,
      git: info,
      coreVersion: options.coreVersion
    });

    // neither of these rely on the other, let them interleave
    const steps = [];

    if (deploymentTypes.assets) {
      const assetsLogger = new LoggingChannel({
        logPrefix: 'assets',
        logStream,
        logFile: join(deployRoot, 'assets.log'),
        verbose
      });
      const assetsPipeline = Promise.resolve()
        // run all the external converters
        .then(() => convertAssets(context, assetsLogger))
        .then(() => deployModule.assets.deploy(context, assetsLogger));
      steps.push(assetsPipeline);
    }

    if (deploymentTypes.lambda) {
      const lambdaLogger = new LoggingChannel({
        logPrefix: 'lambda',
        logStream,
        logFile: join(deployRoot, 'lambda.log'),
        verbose
      });
      steps.push(deployModule.lambda.deploy(context, lambdaLogger));
    }

    await Promise.all(steps);

    if (deploymentTypes.manifest) {
      const lambdaLogger = new LoggingChannel({
        logPrefix: 'manifest',
        logStream,
        logFile: join(deployRoot, 'manifest.log'),
        verbose
      });
      await deployModule.manifest.deploy(context, lambdaLogger);
    }

    // model upload must be after the manifest, as the skill must exist
    if (deploymentTypes.model) {
      await deployModule.model.deploy(skill);
    }

    const deltaTime = new Date() - deploymentStartTime;
    logger.important(`deployment complete in ${deltaTime}ms`);
  } catch (err) {
    if (err.location && err.message) {
      const location = formatLocationStart(err.location);
      const name = err.name ? err.name : 'Error';
      const { message } = err;
      const line = `${location}: ${name}: ${message}`;
      logger.error(line);
    } else {
      logger.error(err);
    }

    const deltaTime = new Date() - deploymentStartTime;
    logger.important(`deployment FAILED in ${deltaTime}ms`);
  }
};

export default {
  run
};
