/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

let mockArtifact = {};

class MockProjectInfoInterface {
  constructor() {
    this.languages = [];
  }
};

class MockTemplateFilesHandlerInterface {
  constructor() {}

  syncDir() {
    return true;
  }
};


class MockDirectoryCreator {
  constructor() {}

  ensureDirExists() {
    return true;
  }

  create() {
    return true;
  }

  sync() {
    return true;
  }
};

class MockDirectoryCreatorInterface {
  constructor() {
    return new MockDirectoryCreator();
  }
};

class MockArtifactInterface {
  constructor() {}

  saveGlobal() {
    return mockArtifact;
  }
};

export default {
  mockArtifact,
  MockArtifactInterface,
  MockDirectoryCreator,
  MockDirectoryCreatorInterface,
  MockProjectInfoInterface,
  MockTemplateFilesHandlerInterface
};
