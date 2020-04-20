/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const crypto = require('crypto');
const rimraf = require('rimraf');
const ProjectConfig = require('./project-config');

const createLitexaConfigSHA256 = configFile => new Promise((resolve, reject) => {
  const shasum = crypto.createHash('sha256');
  return fs.createReadStream(configFile)
    .on('data', chunk => shasum.update(chunk))
    .on('end', () => resolve(shasum.digest('base64')))
    .on('error', err => reject(err));
});

async function run(options) {
  // nuke these directories if Litexa config has changed
  const locationsToWipe = [ '.deploy', '.test' ];
  let currentHash = '';
  let storedHash = '';
  let litexaProjectRoot = options.root;
  try {
    const litexaConfigPath = await ProjectConfig.identifyConfigFileFromPath(options.root);
    currentHash = await createLitexaConfigSHA256(litexaConfigPath);
    litexaProjectRoot = path.parse(litexaConfigPath).dir;
    for (let i=0; i<locationsToWipe.length; i++) {
      const location = locationsToWipe[i];
      locationsToWipe[i] = path.join(litexaProjectRoot, location);
    }
  } catch (err) {
    // do nothing if we don't have a Litexa config
    return;
  }

  const litexaConfigHash = path.join(litexaProjectRoot, '.deploy', 'litexaConfig.hash');
  try {
    storedHash = fs.readFileSync(litexaConfigHash, 'utf8');
  } catch (err) {}

  if (currentHash !== storedHash) {
    for (let location of locationsToWipe) {
      rimraf.sync(location);
    }
  }
  mkdirp.sync(path.join(litexaProjectRoot, '.deploy'));

  fs.writeFileSync(litexaConfigHash, currentHash, 'utf8');
};

module.exports = {
  run
};
