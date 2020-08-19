/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { join } from 'path';
import StructureCreator from './structureCreator';
import '../../../getter.polyfill';

/*
* Directory Structure
*
* /litexa       -- Contains litexa specific files
* /lib          -- Root folder for application being developed
*   /services   -- Location for service layer calls / data access calls
*   /components -- Location for misc business logic ordered by components
* /test         -- Test root folder for the application being developer
*   /services   -- Location for service layer calls / data access calls tests
*   /components -- Location for misc business logic ordered by components tests
*
* Sample Generated Output (-c typescript -s typescript -b webpack)
*
├── .mocharc.json
├── lib
│   ├── components
│   │   ├── logger.ts
│   │   └── utils.ts
│   ├── index.ts
│   ├── pino-pretty.d.ts
│   └── services
│       └── time.service.ts
├── artifacts.json
├── aws-config.json
├── globals.d.ts
├── litexa
│   ├── assets
│   │   ├── icon-108.png
│   │   └── icon-512.png
│   ├── main.litexa
│   └── main.test.litexa
├── package.json
├── litexa.config.js
├── litexa.config.ts
├── skill.ts
├── test
│   ├── components
│   │   └── utils.spec.ts
│   └── services
│       └── time.service.spec.ts
├── tsconfig.json
├── tslint.json
└── webpack.config.js
*
*/

let libDir = undefined;
let testDir = undefined;
let commonDir = undefined;

class BundlerStructureCreator extends StructureCreator {
  static initClass() {
    libDir = 'lib';
    testDir = 'test';
    commonDir = 'common';

    // Getters and Setters

    this.getter('libDirectory', function () {
      if (this.libFolder) { return this.libFolder; }
      return this.libFolder = join(this.rootPath, libDir);
    });

    this.getter('testDirectory', function () {
      if (this.testFolder) { return this.testFolder; }
      return this.testFolder = join(this.rootPath, testDir);
    });

    this.getter('libServicesDirectory', function () {
      if (this.libServicesFolder) { return this.libServicesFolder; }
      return this.libServicesFolder = join(this.libDirectory, 'services');
    });

    this.getter('libComponentsDirectory', function () {
      if (this.libComponentsFolder) { return this.libComponentsFolder; }
      return this.libComponentsFolder = join(this.libDirectory, 'components');
    });

    this.getter('testServicesDirectory', function () {
      if (this.testServicesFolder) { return this.testServicesFolder; }
      return this.testServicesFolder = join(this.testDirectory, 'services');
    });

    this.getter('testComponentsDirectory', function () {
      if (this.testComponentsFolder) { return this.testComponentsFolder; }
      return this.testComponentsFolder = join(this.testDirectory, 'components');
    });
  }

  create() {
    this.ensureDirExists(this.litexaDirectory);
    this.ensureDirExists(this.libServicesDirectory);
    this.ensureDirExists(this.libComponentsDirectory);
    this.ensureDirExists(this.testServicesDirectory);
    this.ensureDirExists(this.testComponentsDirectory);
  }

  sync() {
    const prefix = this.strategy();

    const litexaSource = this.path.join(commonDir, 'litexa');
    let commonLanguageSource = this.path.join(commonDir, this.sourceLanguage);
    if (this.sourceLanguage === 'typescript') {
      commonLanguageSource = this.path.join(commonLanguageSource, 'source');
    }
    let strategyLanguageSource = this.path.join(prefix, this.sourceLanguage);
    if (this.sourceLanguage === 'typescript') {
      strategyLanguageSource = this.path.join(strategyLanguageSource, 'source');
    }

    const languageDirs = [
      commonLanguageSource,
      strategyLanguageSource
    ];

    // Populate litexa folder
    this.templateFilesHandler.syncDir({
      sourcePaths: [
        litexaSource
      ],
      destination: this.litexaDirectory,
      whitelist: [
        'main.*litexa'
      ]
    });

    // Populate top-level lib directory
    const libDirWhitelist = [
      'index.(js|coffee|ts)$'
    ];
    if (this.sourceLanguage === 'typescript') {
      libDirWhitelist.push('.*\\.d.ts$');
    }

    this.templateFilesHandler.syncDir({
      sourcePaths: languageDirs,
      destination: this.libDirectory,
      dataTransform: this.dataTransform.bind(this),
      whitelist: libDirWhitelist
    });

    // Populate lib services
    this.templateFilesHandler.syncDir({
      sourcePaths: languageDirs,
      destination: this.libServicesDirectory,
      dataTransform: this.dataTransform.bind(this),
      whitelist: [
        '.*\\.service\\.(js|coffee|ts)$'
      ]
    });

    // Populate lib components
    this.templateFilesHandler.syncDir({
      sourcePaths: languageDirs,
      destination: this.libComponentsDirectory,
      dataTransform: this.dataTransform.bind(this),
      whitelist: [
        'utils\\.(js|coffee|ts)$',
        'logger\\.(js|coffee|ts)$'
      ]
    });

    // Populate lib services tests
    this.templateFilesHandler.syncDir({
      sourcePaths: languageDirs,
      destination: this.testServicesDirectory,
      dataTransform: this.dataTransform.bind(this),
      whitelist: [
        '.*\\.service\\.spec\\.(js|coffee|ts)$'
      ]
    });

    // Populate lib components tests
    this.templateFilesHandler.syncDir({
      sourcePaths: languageDirs,
      destination: this.testComponentsDirectory,
      dataTransform: this.dataTransform.bind(this),
      whitelist: [
        'utils.spec.(js|coffee|ts)$'
      ]
    });

    // Populate and override top-level files and configurations
    if (this.sourceLanguage === 'typescript') {
      languageDirs.unshift(this.path.join(prefix, this.sourceLanguage, 'config'));
      languageDirs.unshift(this.path.join(commonDir, this.sourceLanguage, 'config'));
    }

    return this.templateFilesHandler.syncDir({
      sourcePaths: [litexaSource].concat(languageDirs),
      destination: this.rootPath,
      dataTransform: this.dataTransform.bind(this),
      whitelist: [
        '\\.gitignore$',
        '.*\\.md$',
        '.*\\.json$',
        '.*\\.opts$',
        '.*rc$',
        'webpack.config.js'
      ]
    });
  }
};
BundlerStructureCreator.initClass();

export default BundlerStructureCreator;
