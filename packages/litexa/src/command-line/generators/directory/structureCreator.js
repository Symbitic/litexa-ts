/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import searchReplace from '../searchReplace';
import strategies from '../../bundlingStrategies';

export default class StructureCreator {
  get litexaDirectory() {
    if (this.litexaFolder) { return this.litexaFolder; }
    return this.litexaFolder = this.path.join(this.rootPath, 'litexa');
  }

  constructor(args) {
    this.logger = args.logger;
    this.rootPath = args.rootPath;
    this.sourceLanguage = args.sourceLanguage;
    this.templateFilesHandler = args.templateFilesHandler;
    this.bundlingStrategy = args.bundlingStrategy;
    this.projectName = args.projectName;
    this.fs = args.syncFileHandler || fs;
    this.mkdirp = args.syncDirWriter || mkdirp;
    this.path = args.path || path;
  }

  /*
  get litexaDirectory() {
    if (!this.litexaFolder) {
      this.litexaFolder = this.path.join(this.rootPath, 'litexa');
    }
    return this.litexaFolder;
  }
  */

  ensureDirExists(directory) {
    if (!this.fs.existsSync(directory)) {
      this.logger.log(`no ${directory} directory found -> creating it`);
      this.mkdirp.sync(directory);
    }
  }

  strategy() {
    return strategies[this.bundlingStrategy];
  }

  create() {
    throw new Error(`${this.constructor.name}#create not implemented`);
  }

  sync() {
    throw new Error(`${this.constructor.name}#sync not implemented`);
  }

  dataTransform(dataString) {
    return searchReplace(dataString, {
      name: this.projectName
    });
  }
};
