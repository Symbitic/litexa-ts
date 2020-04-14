/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import fs from 'fs';
import path from 'path';

class Cache {
  constructor(data, filename) {
    this.data = data;
    this.filename = filename;
    if (!('timestamps' in this.data)) {
      this.data.timestamps = {};
    }
    if (!('hashes' in this.data)) {
      this.data.hashes = {};
    }
  }

  save() {
    return fs.writeFile(this.filename, JSON.stringify(this.data, null, 2), 'utf8', function(err) {});
  }
      // don't care


  saveTimestamp(name) {
    if (name == null) {
      throw new Error("bad timestamp name given to local cache");
    }
    this.data.timestamps[name] = (new Date).getTime();
    return this.save();
  }

  millisecondsSince(name) {
    if (!(name in this.data.timestamps)) {
      return null;
    }
    return (new Date()).getTime() - this.data.timestamps[name];
  }

  longerThanSince(name, seconds) {
    // time checks are in minutes
    if (!(name in this.data.timestamps)) {
      return false;
    }

    const delta = (new Date).getTime() - this.data.timestamps[name];
    return (delta / 1000 / 60) > seconds;
  }

  lessThanSince(name, seconds) {
    if (!(name in this.data.timestamps)) {
      return false;
    }

    const delta = (new Date).getTime() - this.data.timestamps[name];
    return (delta / 1000 / 60) < seconds;
  }

  timestampExists(name) {
    return name in this.data.timestamps;
  }

  storeHash(name, hash) {
    this.data.hashes[name] = hash;
    return this.save();
  }

  getHash(name) {
    return this.data.hashes[name];
  }

  hashMatches(name, hash) {
    return this.data.hashes[name] === hash;
  }
}

export function loadCache(context) {
  const cacheFilename = path.join(context.deployRoot, 'local-cache.json');
  let data = {};

  try {
    data = JSON.parse(fs.readFileSync(cacheFilename, 'utf8'));
  } catch (err) {}

  if (!context.cache) {
    data = {};
  }

  return context.localCache = new Cache(data, cacheFilename);
};

export default {
  loadCache
};
