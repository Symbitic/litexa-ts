/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const chalk = require('chalk');
const skillBuilder = require('./skill-builder');

async function run(options, after) {
  const logger = options.logger ? options.logger : console;

  if (logger.disableColor) {
    chalk.enabled = false;
  }

  const error = line => {
    logger.log(chalk.red(line));
    if (after) {
      after(err);
    }
  };

  try {
    const skill = await skillBuilder.build(options.root, options.deployment);
    switch (options.type) {
      case 'model':
        const model = skill.toModelV2(options.region != null ? options.region : 'default');
        return logger.log(JSON.stringify(model, null, 2));
      case 'handler':
        var lambda = skill.toLambda();
        return logger.log(lambda);
      default:
        return error(`unrecognized printer ${options.type}`);
    }
  } catch (err) {
    return error(err);
  }
};

module.exports = {
  run
};
