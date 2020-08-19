/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { assert, expect } from 'chai';
import { match, spy, stub } from 'sinon';

import GenerateCommandDirector from '../../../src/command-line/generateCommandDirector';

describe('GenerateCommandDirector', () => {
  let targetDirectory: any = undefined;
  let selectedOptions: any = undefined;
  let availableOptions: any = undefined;
  let promptStub: any = undefined;
  let inquirer: any = undefined;

  beforeEach(() => {
    targetDirectory = '.';
    selectedOptions = {
      configLanguage: 'javascript',
      sourceLanguage: 'json',
      bundlingStrategy: 'webpack',
      extraJunk: 'randomInput'
    };
    availableOptions = [
      'configLanguage',
      'sourceLanguage',
      'bundlingStrategy'
    ];
    inquirer = {
      prompt() { return undefined; }
    };
    return promptStub = stub(inquirer, 'prompt');
  });

  describe('#direct', () => {
    it(`returns a set of options that contains the values of the selected options based on available \
options and augments with target directory`, async () => {
      const director = new GenerateCommandDirector({
        targetDirectory,
        selectedOptions,
        availableOptions,
        inputHandler: inquirer
      });

      const options = await director.direct();

      expect(options).to.deep.equal({
        dir: '.',
        configLanguage: 'javascript',
        sourceLanguage: 'json',
        bundlingStrategy: 'webpack'
      });
    });

    it('does not prompt for a directory', async () => {
      promptStub.withArgs(match({name: 'language'})).returns({language: 'javascript'});
      promptStub.withArgs(match({name: 'bundlingStrategy'})).returns({bundlingStrategy: 'none'});
      const director = new GenerateCommandDirector({
        targetDirectory,
        selectedOptions: {},
        availableOptions,
        inputHandler: inquirer
      });

      await director.direct();
      assert(promptStub.neverCalledWith(match({message: 'In which directory would you like to generate your project?'})), 'does not prompt for a directory');
    });

    it('prompts for the directory', async () => {
      promptStub.withArgs(match({name: 'targetDir'})).returns({targetDir: '.'});
      promptStub.withArgs(match({name: 'language'})).returns({language: 'javascript'});
      promptStub.withArgs(match({name: 'bundlingStrategy'})).returns({bundlingStrategy: 'none'});
      const director = new GenerateCommandDirector({
        selectedOptions: {},
        availableOptions,
        inputHandler: inquirer
      });

      await director.direct();

      assert(promptStub.calledWith(match({
        message: 'In which directory would you like to generate your project?'
      })), 'prompts for a directory');
    });

    it('prompts the user about language choice', async () => {
      promptStub.withArgs(match({name: 'targetDir'})).returns({targetDir: '.'});
      promptStub.withArgs(match({name: 'language'})).returns({language: 'javascript'});
      promptStub.withArgs(match({name: 'bundlingStrategy'})).returns({bundlingStrategy: 'none'});
      const director = new GenerateCommandDirector({
        selectedOptions: {},
        availableOptions,
        inputHandler: inquirer
      });

      await director.direct();

      assert(promptStub.calledWith(match({message: 'Which language do you want to write your code in?'})), 'prompts for a language');
    });

    it('prompts the user about code organization', async () => {
      promptStub.withArgs(match({name: 'targetDir'})).returns({targetDir: '.'});
      promptStub.withArgs(match({name: 'language'})).returns({language: 'javascript'});
      promptStub.withArgs(match({name: 'bundlingStrategy'})).returns({bundlingStrategy: 'none'});
      const director = new GenerateCommandDirector({
        selectedOptions: {},
        availableOptions,
        inputHandler: inquirer
      });

      await director.direct();

      assert(promptStub.calledWith(match({message: 'How would you like to organize your code?'})), 'prompts for a bundling strategy');
    });

    it('returns a set of options that contains the responses to the prompts', async () => {
      promptStub.withArgs(match({name:'targetDir'})).returns({targetDir: 'sample'});
      promptStub.withArgs(match({name:'language'})).returns({language: 'javascript'});
      promptStub.withArgs(match({name:'bundlingStrategy'})).returns({bundlingStrategy: 'none'});
      const director = new GenerateCommandDirector({
        selectedOptions: {},
        availableOptions,
        inputHandler: inquirer
      });

      const options = await director.direct();

      expect(options).to.deep.equal({
        dir: 'sample',
        configLanguage: 'javascript',
        sourceLanguage: 'javascript',
        bundlingStrategy: 'none'
      });
    });

    it('returns a set options that contains the response to the prompts and the provided directory', async () => {
      promptStub.withArgs(match({name: 'targetDir'})).returns({targetDir: 'sample'});
      promptStub.withArgs(match({name: 'language'})).returns({language: 'javascript'});
      promptStub.withArgs(match({name: 'bundlingStrategy'})).returns({bundlingStrategy: 'none'});
      const director = new GenerateCommandDirector({
        targetDirectory,
        selectedOptions: {},
        availableOptions,
        inputHandler: inquirer
      });

      const options = await director.direct();

      expect(options).to.deep.equal({
        dir: '.',
        configLanguage: 'javascript',
        sourceLanguage: 'javascript',
        bundlingStrategy: 'none'
      });
    });
  });
});
