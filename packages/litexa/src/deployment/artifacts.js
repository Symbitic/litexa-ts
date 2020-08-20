/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { readFile, writeFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const readFilePromise = promisify(readFile);

export class Artifacts {
  constructor(filename, data) {
    this.filename = filename;
    this.data = data;
    this.data = this.data ? this.data : {};
    if (!('variants' in this.data)) {
      this.data.variants = {};
    }
    if (!('globals' in this.data)) {
      this.data.globals = {};
    }
  }

  setVariant(variant) {
    this.variant = variant;
    if (!(this.variant in this.data.variants)) {
      this.data.variants[this.variant] = {};
    }
    if (!('versions' in this.data.variants[this.variant])) {
      this.data.variants[this.variant].versions = [
        {}
      ];
    }
    this.currentVersion = this.data.variants[this.variant].versions.length - 1;
    this.variantInfo = this.data.variants[this.variant].versions[this.currentVersion];
  }

  save(key, value) {
    if (this.variantInfo == null) {
      throw "failed to set artifact because no variant is currently set";
    }
    this.variantInfo[key] = value;
    this.flush();
  }

  delete(key) {
    if (this.variantInfo == null) {
      throw "failed to remove artifact because no variant is currently set";
    }
    if (this.variantInfo[key] != null) {
      delete this.variantInfo[key];
      this.flush();
    }
  }

  saveGlobal(key, value) {
    this.data.globals[key] = value;
    this.flush();
  }

  flush() {
    if (this.filename) {
      writeFileSync(this.filename, JSON.stringify(this.data, null, 2), 'utf8');
    }
  }

  get(key) {
    if (this.variantInfo == null) {
      throw "failed to get artifact because no variant is currently set";
    }
    return this.variantInfo[key];
  }
}

export function loadArtifacts({ context, logger }) {
  const filename = join(context.projectRoot, 'artifacts.json');
  return readFilePromise(filename, 'utf8')
  .catch(err => {
    if (err.code === 'ENOENT') {
      // that's fine, doesn't exist yet
      return Promise.resolve('{}');
    }
    logger.error(err);
  })
  .then((data) => {
    context.artifacts = new Artifacts(filename, JSON.parse(data));
    context.artifacts.setVariant(context.projectInfo.variant);

    logger.verbose("loaded artifacts.json");
  });
};

export default {
  Artifacts,
  loadArtifacts
};
