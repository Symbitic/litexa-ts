/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { existsSync } from 'fs';
import { sync } from 'mkdirp';
import { join } from 'path';
import Generator from './generator';

class AssetsDirectoryGenerator extends Generator {
  static initClass() {
    this.description = 'assets directory';
  }

  constructor(args) {
    super(args);
    this.description = 'assets directory';
  }

  // Public Interface
  generate() {
    const folder = join(this._rootPath(), 'litexa', 'assets');
    if (existsSync(folder)) {
      this.logger.log('existing litexa/assets directory found -> skipping creation');
      return Promise.resolve();
    }

    this.logger.log('creating litexa/assets -> place any image/sound asset files that should be deployed here');
    sync(folder);
    return Promise.resolve();
  }
};
AssetsDirectoryGenerator.initClass();

export default AssetsDirectoryGenerator;
