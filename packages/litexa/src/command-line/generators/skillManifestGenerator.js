/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import extensions from '../fileExtensions';
import { existsSync, writeFileSync } from 'fs';
import manifest from '../manifest';
import { join } from 'path';
import Generator from './generator';
import skillStoreTitleValidate from './validators/skillStoreTitleValidator';
import '../../getter.polyfill';

export default class SkillManifestGenerator extends Generator {
  static initClass() {
    this.description = 'skill manifest';

    // Getters / Setters
    this.getter('defaultProjectName', function() {
      if (this.nameCandidate) { return this.nameCandidate; }
      const nameCandidate = this.options.projectConfig != null ? this.options.projectConfig.name : undefined;
      try {
        if (skillStoreTitleValidate(nameCandidate)) { this.nameCandidate = nameCandidate; }
      } catch (error) {}
      return this.nameCandidate;
    });
  }

  constructor(args) {
    super(args);
    this.inquirer = args.inputHandler;
    this.storeTitleName = this.options.storeTitleName;
  }

  // public interface
  async generate() {
    let name;
    const extension = extensions[this._configLanguage()];

    if (extension == null) {
      throw new Error(`${this._configLanguage()} language extension not found`);
    }

    const filename = `skill.${extension}`;
    const filePath = join(this._rootPath(), `skill.${extension}`);

    if (existsSync(filePath)) {
      this.logger.log(`existing ${filename} found -> skipping creation`);
      return Promise.resolve();
    }

    const options = {
      type: 'input',
      name: 'storeTitleName',
      message: this._inputQuestion(),
      validate: skillStoreTitleValidate
    };
    if (this.defaultProjectName) {
      options.default = this.defaultProjectName;
    }

    if (this.storeTitleName && skillStoreTitleValidate(this.storeTitleName)) {
      this.logger.log(`Using skill title \"${this.storeTitleName}\"`);
      name = this.storeTitleName;
    } else {
      const result = await this.inquirer.prompt(options);
      name = result.storeTitleName;
    }

    const skillManifest = manifest.create(name, this._configLanguage());
    writeFileSync(filePath, skillManifest, 'utf8');
    this.logger.log(`creating ${filename} -> contains skill manifest and should be version controlled`);
  }

  // "private" methods
  _inputQuestion() {
    let question =  'What would you like the skill store title of the project to be?';
    if (this.defaultProjectName != null) {
      question = `${question} (default: \"${this.defaultProjectName}\")`;
    }
    return question;
  }

  _configLanguage() {
    return this.options.configLanguage;
  }
}
SkillManifestGenerator.initClass();
