/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const StructureCreator = require('./structureCreator');

/*
* Directory Structure
*
* /litexa   -- Contains all Generated files
*
* Sample Generated Output (-c json -b none -s javascript)
.
├── artifacts.json
├── aws-config.json
├── litexa
│   ├── assets
│   │   ├── icon-108.png
│   │   └── icon-512.png
│   ├── main.litexa
│   ├── main.test.litexa
│   ├── utils.js
│   └── utils.test.js
├── litexa.config.json
└── skill.json
*
*/

class InlinedStructureCreator extends StructureCreator {
  constructor(args) {
    super(args);
    this.commonDir = 'common';
  }

  create() {
    return this.ensureDirExists(this.litexaDirectory);
  }

  sync() {
    const litexaSource = this.path.join(this.commonDir, 'litexa');
    const commonLanguageSource = this.path.join(this.commonDir, this.sourceLanguage);
    const strategyLanguageSource = this.path.join(this.strategy(), this.sourceLanguage);

    const dirs = [
      litexaSource,
      commonLanguageSource,
      strategyLanguageSource
    ];

    // litexa directory files
    this.templateFilesHandler.syncDir({
      sourcePaths: dirs,
      destination: this.litexaDirectory,
      dataTransform: this.dataTransform.bind(this),
      whitelist: [
        'main.*litexa',
        'util.*(js|coffee|ts)',
        '.*\\.json',
        '.*\\.opts'
      ]
    });

    // root directory files
    return this.templateFilesHandler.syncDir({
      sourcePaths: dirs,
      destination: this.rootPath,
      dataTransform: this.dataTransform.bind(this),
      whitelist: [
        '.*\\.md$',
        '\\.gitignore$'
      ]
    });
  }
};

module.exports = InlinedStructureCreator;
