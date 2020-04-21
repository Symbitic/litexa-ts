/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const Generator = require('./generator');

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
    const folder = path.join(this._rootPath(), 'litexa', 'assets');
    if (fs.existsSync(folder)) {
      this.logger.log('existing litexa/assets directory found -> skipping creation');
      return Promise.resolve();
    }

    this.logger.log('creating litexa/assets -> place any image/sound asset files that should be deployed here');
    mkdirp.sync(folder);
    return Promise.resolve();
  }
};
AssetsDirectoryGenerator.initClass();

module.exports = AssetsDirectoryGenerator;
