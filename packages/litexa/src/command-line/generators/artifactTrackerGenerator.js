/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import Generator from './generator';

const currentTime = () => (new Date).getTime();

class ArtifactTrackerGenerator extends Generator {
  static initClass() {
    this.description = 'artifacts tracker';
  }

  constructor(args) {
    super(args);
    this.artifactClass = args.artifactClass;
  }

  // Public Interface
  generate() {
    const filename = 'artifacts.json';
    const source = join(this._rootPath(), filename);

    let data = {};
    if (existsSync(source)) {
      this.logger.log(`existing ${filename} found -> skipping creation`);
      data = JSON.parse(readFileSync(source, 'utf8'));
    } else {
      this.logger.log(`creating ${filename} -> contains deployment records and should be version controlled`);
    }

    const artifacts = new this.artifactClass(source, data);
    artifacts.saveGlobal('last-generated', currentTime());

    // Direct Public Side-Effect
    this.options.artifacts = artifacts;

    return Promise.resolve();
  }
};
ArtifactTrackerGenerator.initClass();

export default ArtifactTrackerGenerator;
