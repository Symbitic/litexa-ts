/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const inquirer = require('inquirer');

class GenerateCommandDirector {
  constructor(args) {
    this.targetDirectory = args.targetDirectory;
    this.selectedOptions = args.selectedOptions;
    this.availableOptions = args.availableOptions;
    this.inquirer = args.inputHandler || inquirer;
  }

  async direct() {
    const options = {};

    const selectedAtLeastOneOption = this.availableOptions.reduce(this.optionExists.bind(this), false);
    if (selectedAtLeastOneOption) {
      options.dir = this.targetDirectory;
      this.availableOptions.forEach(option => {
        options[option] = this.selectedOptions[option];
      });
    } else {
      options.dir = this.targetDirectory;
      if (this.targetDirectory) {
        options.dir = this.targetDirectory;
      } else {
        options.dir = await this._inquireAboutTargetDirectory();
      }
      const language = await this._inqureAboutLanguageChoice();
      const strategy = await this._inquireAboutCodeOrganization();

      options.configLanguage = language;
      options.sourceLanguage = language;
      options.bundlingStrategy = strategy;
    }

    return options;
  }

  async _inquireAboutTargetDirectory() {
    const result = await this.inquirer.prompt({
      type: 'input',
      name: 'targetDir',
      message: 'In which directory would you like to generate your project?',
      default: '.'
    });
    return result.targetDir;
  }

  async _inqureAboutLanguageChoice() {
    const result = await this.inquirer.prompt({
      type: 'list',
      name: 'language',
      message: 'Which language do you want to write your code in?',
      default: {
        value: 'javascript'
      },
      choices: [
        {
          name: 'JavaScript',
          value: 'javascript'
        },
        {
          name: 'TypeScript',
          value: 'typescript'
        },
        {
          name: 'CoffeeScript',
          value: 'coffee'
        }
      ]
    });
    return result.language;
  }

  async _inquireAboutCodeOrganization() {
    const result = await this.inquirer.prompt({
      type: 'list',
      name: 'bundlingStrategy',
      message: 'How would you like to organize your code?',
      default: {
        value: 'none'
      },
      choices: [
        {
          name: 'Inlined in litexa. (useful for small projects with no dependencies)',
          value: 'none'
        },
        {
          name: "As modules. (useful for organizing code as npm packages)",
          value: 'npm-link'
        },
        {
          name: 'As an application. (useful if you have external dependencies)',
          value: 'webpack'
        }
      ]
    });
    return result.bundlingStrategy;
  }

  optionExists(exists, option) {
    return exists || this.selectedOptions.hasOwnProperty(option);
  }
}

module.exports = GenerateCommandDirector;
