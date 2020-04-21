/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const Generator = require('./generator');

class SourceCodeGenerator extends Generator {
  static initClass() {
    this.description = 'litexa entry point';
  }

  constructor(args) {
    super(args);
    this.bundlingStrategy = this.options.bundlingStrategy;
    this.projectInfoClass = args.projectInfoClass;
    this.templateFilesHandlerClass = args.templateFilesHandlerClass;
    this.directoryCreatorClass = args.directoryCreatorClass;
  }

  // Public Interface
  async generate() {
    // Create the Directory Structure
    const directoryStructureCreator = new this.directoryCreatorClass({
      bundlingStrategy: this.bundlingStrategy,
      logger: this.logger,
      rootPath: this._rootPath(),
      templateFilesHandlerClass: this.templateFilesHandlerClass,
      sourceLanguage: this._language(),
      projectName: this.options.projectConfig.name
    });
    directoryStructureCreator.create();

    // Sync the Project Files
    if (!this._hasLitexaCode()) {
      this.logger.log("no code files found in litexa -> creating them");
      directoryStructureCreator.sync();
    } else {
      this.logger.log("existing code files found in litexa -> skipping creation");
    }
  }

  _hasLitexaCode() {
    if (this.foundLitexaCode) {
      return this.foundLitexaCode;
    }

    const projectInfo = new this.projectInfoClass({
      jsonConfig: this._projectConfig()
    });
    for (let languageName in projectInfo.languages) {
      const language = projectInfo.languages[languageName];
      for (let file of language.code.files) {
        if (file.indexOf('.litexa') > 0) {
          this.foundLitexaCode = true;
          break;
        }
      }
    }

    return this.foundLitexaCode;
  }

  _projectConfig() {
    return this.options.projectConfig;
  }

  _language() {
    if (this.language) {
      return this.language;
    }
    return this.language = this.options.sourceLanguage;
  }
}
SourceCodeGenerator.initClass();

module.exports = SourceCodeGenerator;
