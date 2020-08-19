/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { createReadStream, readFileSync, writeFileSync } from 'fs';
import { parse, join } from 'path';
import { sync } from 'mkdirp';
import { createHash } from 'crypto';
import { sync as _sync } from 'rimraf';
import { identifyConfigFileFromPath } from './project-config';

const createLitexaConfigSHA256 = configFile => new Promise((resolve, reject) => {
  const shasum = createHash('sha256');
  return createReadStream(configFile)
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
    const litexaConfigPath = await identifyConfigFileFromPath(options.root);
    currentHash = await createLitexaConfigSHA256(litexaConfigPath);
    litexaProjectRoot = parse(litexaConfigPath).dir;
    for (let i=0; i<locationsToWipe.length; i++) {
      const location = locationsToWipe[i];
      locationsToWipe[i] = join(litexaProjectRoot, location);
    }
  } catch (err) {
    // do nothing if we don't have a Litexa config
    return;
  }

  const litexaConfigHash = join(litexaProjectRoot, '.deploy', 'litexaConfig.hash');
  try {
    storedHash = readFileSync(litexaConfigHash, 'utf8');
  } catch (err) {}

  if (currentHash !== storedHash) {
    for (let location of locationsToWipe) {
      _sync(location);
    }
  }
  sync(join(litexaProjectRoot, '.deploy'));

  writeFileSync(litexaConfigHash, currentHash, 'utf8');
};

export default {
  run
};
