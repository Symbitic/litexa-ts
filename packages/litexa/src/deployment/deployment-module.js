/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const path = require('path');
const fs = require('fs');
const debug = require('debug')('litexa');

function deploymentModule(projectRoot, deploymentOptions, logger) {
  // load deployment extension, assumed to either be local
  // or installed globally wherever npm install -g goes
  if (!deploymentOptions.module) {
    throw "deployment.module not defined in litexa.config.json";
  }

  let deployModule;
  let npmGlobalPath;
  const tryPath = fn => {
    if (deployModule) {
      return;
    }
    const prefix = fn();
    const fullPath = path.join(prefix, deploymentOptions.module);
    debug(`searching for deployment module in ${fullPath}`);
    if (!fs.existsSync(fullPath)) {
      debug(`no deploy module, ${err}`);
      return;
    }

    try {
      deployModule = require(fullPath);
      return logger.log(`loaded deployment module from ${fullPath}`);
    } catch (err) {
      return logger.error(`failed to load deployment module: ${err}`);
    }
  };

  tryPath(() => path.join(projectRoot, 'node_modules'));

  tryPath(() => {
    // ask npm where its globals are
    const {execSync} = require('child_process');
    npmGlobalPath = execSync('npm config get prefix').toString().trim();
    debug(`npm global path is ${npmGlobalPath}`);
    if (!fs.existsSync(npmGlobalPath)) {
      throw `failed to retrieve global modules path with \`npm config get prefix\` Try and run this yourself to debug why.`;
    }

    return path.join(npmGlobalPath, 'node_modules');
  });

  tryPath(() => path.join(npmGlobalPath, 'lib', 'node_modules'));

  if (deployModule) {
    return deployModule;
  }

  throw `Failed to load deployment module ${deploymentOptions.module}, from both the local and global locations. Have you npm installed it?`;
};

module.exports = deploymentModule;
