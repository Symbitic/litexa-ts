/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const {fake, match, spy} = require('sinon');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const {assert, expect} = chai;

const fs = require('fs');
const SkillManifestGenerator = require('@src/command-line/generators/skillManifestGenerator');

describe('SkillManifestGenerator', function() {
  describe('#description', () => it('has a class property to describe itself', function() {
    assert(SkillManifestGenerator.hasOwnProperty('description'), 'has a property description');
    return expect(SkillManifestGenerator.description).to.equal('skill manifest');
  }));

  return describe('#generate', function() {
    const mockConfig = {
      name: 'mock',
      deployments: {
        development: {
          module: '@litexa/deploy-aws',
          s3Configuration: {
            bucketName: 'mock-litexa-assets'
          },
          askProfile: 'mock'
        }
      },
      plugins: {}
    };

    let loggerInterface = undefined;
    let inquirer = undefined;
    let options = undefined;

    beforeEach(function() {
      options = {
        root: '.',
        configLanguage: 'javascript',
        projectConfig: {
          name: 'mock'
        }
      };
      loggerInterface = {
        log() { return undefined; }
      };
      return inquirer =  {
        prompt: fake.returns(Promise.resolve({storeTitleName: options.projectConfig.name}))
      };});

    afterEach(() => {
      for (let extension of ['coffee', 'js', 'json']) {
        const filename = `skill.${extension}`;
        if (fs.existsSync(filename)) {
          fs.unlinkSync(filename);
        }
      }
    });

    it('returns a promise', function() {
      const skillManifestGenerator = new SkillManifestGenerator({
        options,
        logger: loggerInterface,
        inputHandler: inquirer
      });

      assert.typeOf(skillManifestGenerator.generate(), 'promise', 'it returns a promise');
    });

    it("throws an error for extensions that aren't found", function() {
      options.configLanguage = 'unknownFormat';

      const skillManifestGenerator = new SkillManifestGenerator({
        options,
        logger: loggerInterface,
        inputHandler: inquirer
      });

      const testFn = async () => await skillManifestGenerator.generate();

      return assert.isRejected(testFn(), 'extension not found', 'throws an error');
    });

    it('skips if the file already exists', async function() {
      fs.writeFileSync('skill.js', 'content', 'utf8');
      const logSpy = spy(loggerInterface, 'log');

      const skillManifestGenerator = new SkillManifestGenerator({
        options,
        logger: loggerInterface,
        inputHandler: inquirer
      });

      await skillManifestGenerator.generate();

      const data = fs.readFileSync('skill.js', 'utf8');
      assert(logSpy.calledOnceWith(match('existing skill.js found -> skipping creation')),
        'informed user skipping generator');
      assert(logSpy.neverCalledWith(match('creating')),
        "doesn't misinform the user");
      return assert(data === 'content', 'did not override file');
    });

    it('writes the manifest in JavaScript', async function() {
      const logSpy = spy(loggerInterface, 'log');

      const skillManifestGenerator = new SkillManifestGenerator({
        options,
        logger: loggerInterface,
        inputHandler: inquirer
      });

      await skillManifestGenerator.generate();

      assert(logSpy.neverCalledWith(match('existing skill.js found -> skipping creation')),
        "doesn't misinform the user");
      assert(logSpy.calledWith(match(`creating skill.js -> contains skill manifest and should \
be version controlled`)),
        "informs it's writing the file and prompts user to version control it");
      return assert(fs.existsSync('skill.js'), 'wrote the actual file');
    });

    it('writes the manifest in coffee', async function() {
      options.configLanguage = 'coffee';
      const logSpy = spy(loggerInterface, 'log');

      const skillManifestGenerator = new SkillManifestGenerator({
        options,
        logger: loggerInterface,
        inputHandler: inquirer
      });

      await skillManifestGenerator.generate();

      assert(logSpy.neverCalledWith(match('existing skill.coffee found -> skipping creation')),
        "doesn't misinform the user");
      assert(logSpy.calledWith(match(`creating skill.coffee -> contains skill manifest and should \
be version controlled`)),
        "informs it's writing the file and prompts user to version control it");
      return assert(fs.existsSync('skill.coffee'), 'wrote the actual file');
    });

    it('writes the manifest in json', async function() {
      options.configLanguage = 'json';
      const logSpy = spy(loggerInterface, 'log');

      const skillManifestGenerator = new SkillManifestGenerator({
        options,
        logger: loggerInterface,
        inputHandler: inquirer
      });

      await skillManifestGenerator.generate();

      assert(logSpy.neverCalledWith(match('existing skill.json found -> skipping creation')),
        "doesn't misinform the user");
      assert(logSpy.calledWith(match(`creating skill.json -> contains skill manifest and should \
be version controlled`)),
        "informs it's writing the file and prompts user to version control it");
      return assert(fs.existsSync('skill.json'), 'wrote the actual file');
    });

    it('prompts the user for input with a default store title', async function() {
      options.projectConfig.name = 'sample';

      const skillManifestGenerator = new SkillManifestGenerator({
        options,
        logger: loggerInterface,
        inputHandler: inquirer
      });

      await skillManifestGenerator.generate();

      return assert(
        inquirer.prompt.calledWith(
          match({message: `What would you like the skill store title of the project to be? \
(default: "sample")`})
        ), 'prompted the user with default store title'
      );
    });


    return it('prompts the user for input without a default store title', async function() {
      options.projectConfig.name = 'AlexaEchoSkill';
      const skillManifestGenerator = new SkillManifestGenerator({
        options,
        logger: loggerInterface,
        inputHandler: inquirer
      });

      await skillManifestGenerator.generate();

      return assert(
        inquirer.prompt.calledWith(
          match({message: 'What would you like the skill store title of the project to be?' })
        ), 'prompted the user without default store title'
      );
    });
  });
});
