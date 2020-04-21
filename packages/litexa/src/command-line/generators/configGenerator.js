/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const path = require('path');
const Generator = require('./generator');
const projectNameValidate = require('./validators/projectNameValidator');
require('../../getter.polyfill');
const debug = require('debug')('config-generator');

class ConfigGenerator extends Generator {
  static initClass() {
    this.description = 'config file';

    // Getters / Setters
    this.getter('defaultName', function() {
      if (this.nameCandidate) {
        return this.nameCandidate;
      }
      const nameCandidate = path.basename(this._rootPath());
      try {
        if (projectNameValidate(nameCandidate)) {
          this.nameCandidate = nameCandidate;
        }
      } catch (error) {}
      return this.nameCandidate;
    });
  }

  constructor(args) {
    super(args);
    this.bundlingStrategy = this.options.bundlingStrategy;
    this.projectName = this.options.projectName;
    this.config = args.config;
    this.inquirer = args.inputHandler;
    this.templateFilesHandlerClass = args.templateFilesHandlerClass;
  }

  // Public Methods
  async generate() {
    const configFileName = await this._configFile();

    let configRoot = configFileName ? path.dirname(configFileName) : '';
    if (!configRoot) {
      const options = {
        type: 'input',
        name: 'projectName',
        message: this._inputQuestion(),
        validate: projectNameValidate
      };
      if (this.defaultName) {
        options.default = this.defaultName;
      }

      if (this.projectName && projectNameValidate(this.projectName)) {
        this.logger.log(`Using project name \"${this.projectName}\"`);
        this._writeFiles(this.projectName);
      } else {
        const result = await this.inquirer.prompt(options);
        console.log(result);
        this._writeFiles(result.projectName);
      }

      configRoot = this._rootPath();
    }

    if (configRoot !== this._rootPath()) {
      throw new Error(`Config file found in ancestor directory ${configRoot}`);
    }

    // Direct Public Side-Effect
    this.options.projectConfig = await this.config.loadConfig(configRoot);
  }

  // "Private" Methods
  _inputQuestion() {
    let question =  "What would you like to name the project?";
    if (this.defaultName) {
      question = `${question} (default: \"${this.defaultName}\")`;
    }
    return question;
  }

  _writeFiles(name) {
    const configFilename = this.config.writeDefault(this._rootPath(), this._configLanguage(), name);
    return this.logger.log(`creating ${configFilename} -> contains deployment settings and should be version controlled`);
  }

  async _configFile() {
    try {
      const fileName = await this.config.identifyConfigFileFromPath(this._rootPath());
      this.logger.log(`existing ${fileName} found -> skipping creation`);
      return fileName;
    } catch (err) {
      debug(err);
    }
  }

  _configLanguage() {
    return this.options.configLanguage;
  }
};
ConfigGenerator.initClass();

module.exports = ConfigGenerator;
