/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const Generator = require('./generator').default;
const debug = require('debug')('litexa');

class SkillIconsGenerator extends Generator {
  static initClass() {
    this.description = 'skill icons';
  }

  constructor(args) {
    super(args);
  }

  generate() {
    this._ensureIcon(108);
    this._ensureIcon(512);

    return Promise.resolve();
  }

  // "Private" Methods
  _destination() {
    return path.join(this._rootPath(), 'litexa', 'assets');
  }

  _ensureIcon(size) {
    const name = `icon-${size}.png`;
    const filename = path.join(this._destination(), name);

    if (fs.existsSync(filename)) {
      this.logger.log(`existing assets/${name} found -> skipping creation`);
      return;
    }

    // Create a red circle with a black outline
    const png = {
      width: size,
      height: size,
      data: Buffer.alloc(size * size * 4, 0xff)
    };

    const hh = size / 2;
    let t1 = Math.floor((hh * 29) / 30);
    debug(`${size} icon circle radius ${t1}`);
    let t2 = Math.floor((t1 * 3) / 4);
    t1 = t1 * t1;
    t2 = t2 * t2;
    for (let y = 0, end = size, asc = 0 <= end; asc ? y <= end : y >= end; asc ? y++ : y--) {
      const yy = y - hh;
      for (let x = 0, end1 = size, asc1 = 0 <= end1; asc1 ? x <= end1 : x >= end1; asc1 ? x++ : x--) {
        var idx;
        const xx = x - hh;
        const r = (xx * xx) + (yy * yy);
        if ((r < t1) && (r >= t2)) {
          idx = ((y * size) + x) * 4;
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
        } else if (r < t2) {
          idx = ((y * size) + x) * 4;
          png.data[idx] = 255;
          png.data[idx + 1] = 100;
          png.data[idx + 2] = 100;
        }
      }
    }

    // Write it
    const buffer = PNG.sync.write(png, {});
    return fs.writeFileSync(filename, buffer);
  }
}
SkillIconsGenerator.initClass();

module.exports = SkillIconsGenerator;
