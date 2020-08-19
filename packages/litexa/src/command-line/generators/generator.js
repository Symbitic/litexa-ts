/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

export default class Generator {
  constructor(args) {
    this.options = args.options;
    this.logger = args.logger;
  }

  _rootPath() {
    return this.options.dir || this.options.root;
  }

  generate() {
    throw new Error(`${this.constructor.name}#generate not implemented`);
  }
};
