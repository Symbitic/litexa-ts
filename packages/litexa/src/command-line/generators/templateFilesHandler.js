/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export default class TemplateFilesHandler {
  constructor(args) {
    this.logger = args.logger;
    this.resolvePath = args.syncPathResolver || join;
    this.readDir = args.syncDirectoryReader || readdirSync;
    this.readFile = args.syncFileReader || readFileSync;
    this.writeFile = args.syncFileWriter || writeFileSync;
  }

  // Public Interface
  syncDir(...args) {
    const [ obj ] = args;
    const { sourcePaths, destination } = obj;
    const whitelist = obj.whitelist ? obj.whitelist : [];
    const dataTransform = obj.dataTransform ? obj.dataTransform : data => data;

    for (let sourcePath of sourcePaths) {
      const files = this._listFiles(sourcePath);
      for (let file of this._permit(whitelist, files)) {
        let data = this._readFile(sourcePath, file);
        data = dataTransform(data);
        this._writeFile(destination, file, data);
      }
    }
  }

  // "Private"  Methods
  _permit(whitelist, files) {
    return files.filter(file => whitelist.reduce((acc, cur) => {
      const match = new RegExp(`^${cur}`);
      return acc = acc || (file.search(match) > -1);
    }, false));
  }

  _writeFile(destination, filename, data) {
    const source = join(destination, filename);
    this.writeFile(source, `${data}\n`, 'utf8');
    this.logger.log(`created a default ${filename} file`);
  }

  _listFiles(language) {
    return this.readDir(this.resolvePath(__dirname, '../../../', 'templates', language));
  }

  _readFile(language, file) {
    return this.readFile(this.resolvePath(__dirname, '../../../', 'templates', language, file), 'utf8');
  }
}
