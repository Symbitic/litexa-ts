/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const debug = require('debug')('litexa-assets');

async function convertAssets(context, logger) {
  const cacheRoot = path.join(context.sharedDeployRoot, 'converted-assets');
  debug(`assets conversion cache at ${cacheRoot}`);

  for (let languageName in context.projectInfo.languages) {
    const languageInfo = context.projectInfo.languages[languageName];
    const languageCacheDir = path.join(cacheRoot, languageName);
    mkdirp.sync(languageCacheDir);

    // Add promises to run all of our asset processors.
    for (let kind in languageInfo.assetProcessors) {
      const processor = languageInfo.assetProcessors[kind];
      for (let input of processor.inputs) {
        await processor.process({
          assetName: input,
          assetsRoot: languageInfo.assets.root,
          targetsRoot: languageCacheDir,
          options: processor.options,
          logger
        });
      }
    }
  }

  logger.log('all asset conversion complete');

  // Now, let's check if there were any "default" converted files that aren't available in a
  // localized language. If so, copy these common assets to the language for deployment.
  const defaultCacheDir = path.join(cacheRoot, 'default');

  for (let languageName in context.projectInfo.languages) {
    if (languageName !== 'default') {
      const languageCacheDir = path.join(cacheRoot, languageName);
      const defaultFiles = fs.readdirSync(defaultCacheDir);
      for (let fileName of defaultFiles) {
        const dst = path.join(languageCacheDir, fileName);
        if (!fs.existsSync(dst)) {
          const src = path.join(defaultCacheDir, fileName);
          fs.copyFileSync(src, dst)
        }
      }
    }
  }
};

module.exports = {
  convertAssets
};
