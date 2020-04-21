/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const InlinedStructureCreator = require('./directory/inlinedStructureCreator');
const SeparateStructureCreator = require('./directory/separateStructureCreator');
const BundlerStructureCreator = require('./directory/bundlerStructureCreator');
const strategies = require('../bundlingStrategies');

class DirectoryCreator {
  constructor(args) {
    const strategy = args.bundlingStrategy;

    args.templateFilesHandler = new args.templateFilesHandlerClass({
      logger: args.logger
    });

    switch (strategies[strategy]) {
      case 'inlined':
        return new InlinedStructureCreator(args);
      case 'separate':
        return new SeparateStructureCreator(args);
      case 'bundled':
        return new BundlerStructureCreator(args);
      default:
        throw Error(`Unsupported Bundling Strategy ${strategy}`);
    }
  }
}

module.exports = DirectoryCreator;
