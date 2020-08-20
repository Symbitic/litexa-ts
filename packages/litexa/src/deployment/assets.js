/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { join } from 'path';
import { readdirSync, existsSync, copyFileSync } from 'fs';
import { sync } from 'mkdirp';
import debug from 'debug';

const litexaDebug = debug('litexa-assets');

export async function convertAssets(context, logger) {
  const cacheRoot = join(context.sharedDeployRoot, 'converted-assets');
  litexaDebug(`assets conversion cache at ${cacheRoot}`);

  for (let languageName in context.projectInfo.languages) {
    const languageInfo = context.projectInfo.languages[languageName];
    const languageCacheDir = join(cacheRoot, languageName);
    sync(languageCacheDir);

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
  const defaultCacheDir = join(cacheRoot, 'default');

  for (let languageName in context.projectInfo.languages) {
    if (languageName !== 'default') {
      const languageCacheDir = join(cacheRoot, languageName);
      const defaultFiles = readdirSync(defaultCacheDir);
      for (let fileName of defaultFiles) {
        const dst = join(languageCacheDir, fileName);
        if (!existsSync(dst)) {
          const src = join(defaultCacheDir, fileName);
          copyFileSync(src, dst)
        }
      }
    }
  }
};

export default {
  convertAssets
};
