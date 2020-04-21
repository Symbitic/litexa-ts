/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const path = require('path');
const StructureCreator = require('./structureCreator');
require('../../../getter.polyfill');

/*
* Directory Structure
*
* /litexa -- Contains litexa specific files and package.json link to business logic
* /lib    -- Contains all generated business logic files
*
* Sample Generated Output (-c coffee -s coffee -b npm-link)
*
.
├── artifacts.json
├── aws-config.json
├── lib
│   ├── .mocharc.json
│   ├── index.coffee
│   ├── logger.coffee
│   ├── package.json
│   ├── utils.coffee
│   └── utils.spec.coffee
├── litexa
│   ├── assets
│   │   ├── icon-108.png
│   │   └── icon-512.png
│   ├── main.coffee
│   ├── main.litexa
│   ├── main.test.litexa
│   └── package.json
├── litexa.config.coffee
└── skill.coffee
*
*/

let separateFolder = undefined;
let commonDir = undefined;

class SeparateStructureCreator extends StructureCreator {
  static initClass() {
    separateFolder = 'lib';
    commonDir = 'common';

    // Getters and Setters

    this.getter('separateFolder', function () {
      if (this.separateDir) { return this.separateDir; }
      return this.separateDir = path.join(this.rootPath, separateFolder);
    });
  }

  create() {
    this.ensureDirExists(this.litexaDirectory);
    this.ensureDirExists(this.separateFolder);
  }

  sync() {
    const prefix = this.strategy();

    const litexaSource = this.path.join(commonDir, 'litexa');
    const litexaLanguageHook = this.path.join(prefix, 'litexa');
    let commonLanguageSource = this.path.join(commonDir, this.sourceLanguage);

    if (this.sourceLanguage === 'typescript') {
      commonLanguageSource = this.path.join(commonLanguageSource, 'source');
    }

    const strategyLanguageSource = this.path.join(prefix, this.sourceLanguage);

    const whitelist = [
      'main.*litexa',
      'util.*(js|coffee|ts)',
      'logger.*(js|coffee|ts)',
      'index.*(js|coffee|ts)',
      '.*\\.json',
      '.*\\.opts',
      '\\.es.*',
      '.*rc$'
    ];

    if (this.sourceLanguage === 'coffee') {
      whitelist.push('main.coffee$');
    } else {
      whitelist.push('main.js$');
    }

    if (this.sourceLanguage === 'typescript') {
      whitelist.push('.*\\.d.ts$');
    }

    // litexa directory files
    this.templateFilesHandler.syncDir({
      sourcePaths: [
        litexaSource,
        litexaLanguageHook
      ],
      destination: this.litexaDirectory,
      dataTransform: this.dataTransform.bind(this),
      whitelist
    });

    // lib directory files
    this.templateFilesHandler.syncDir({
      sourcePaths: [
        commonLanguageSource,
        strategyLanguageSource
      ],
      destination: this.separateFolder,
      dataTransform: this.dataTransform.bind(this),
      whitelist
    });

    // root directory files
    return this.templateFilesHandler.syncDir({
      sourcePaths: [
        litexaSource,
        litexaLanguageHook,
        commonLanguageSource,
        strategyLanguageSource
      ],
      destination: this.rootPath,
      dataTransform: this.dataTransform.bind(this),
      whitelist: [
        '.*\\.md$',
        '\\.gitignore$'
      ]
    });
  }
};
SeparateStructureCreator.initClass();

module.exports = SeparateStructureCreator;
