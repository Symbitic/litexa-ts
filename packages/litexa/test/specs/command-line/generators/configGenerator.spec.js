/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const {fake, match, mock, spy, stub} = require('sinon');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const {assert, expect} = chai;

const ConfigGenerator = require('@src/command-line/generators/configGenerator');

describe('ConfigGenerator', function() {
  describe('#description', () => it('has a class property to describe itself', function() {
    assert(ConfigGenerator.hasOwnProperty('description'), 'has a property description');
    return expect(ConfigGenerator.description).to.equal('config file');
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
    let configInterface = undefined;
    let options = undefined;
    const name = 'projectName';

    beforeEach(function() {
      options = {
        root: '.',
        configLanguage: 'javascript',
        bundlingStrategy: 'none'
      };
      loggerInterface = {
        log() { return undefined; }
      };
      inquirer = {
        prompt: fake.returns(Promise.resolve({projectName: name}))
      };
      return configInterface = {
        writeDefault() { return undefined; },
        identifyConfigFileFromPath() { return undefined; },
        loadConfig() { return undefined; }
      };});

    it('returns a promise', function() {
      stub(configInterface, 'identifyConfigFileFromPath').throws();
      stub(configInterface, 'writeDefault').callsFake(() => 'mockFile');
      stub(configInterface, 'loadConfig').callsFake(() => mockConfig);

      const configGenerator = new ConfigGenerator({
        options,
        config: configInterface,
        logger: loggerInterface,
        inputHandler: inquirer
      });

      return assert.typeOf(configGenerator.generate(), 'promise', 'it returns a promise');
    });

    it('mutates options as a direct public side-effect', async function() {
      stub(configInterface, 'identifyConfigFileFromPath').callsFake(() => './mockFile');
      stub(configInterface, 'writeDefault').callsFake(() => 'mockFile');
      stub(configInterface, 'loadConfig').callsFake(() => mockConfig);

      const configGenerator = new ConfigGenerator({
        options,
        config: configInterface,
        logger: loggerInterface,
        inputHandler: inquirer
      });

      await configGenerator.generate();

      assert(options.hasOwnProperty('projectConfig'),
        'modified the options to include a project config');
      return expect(options.projectConfig).to.deep.equal(mockConfig);
    });

    it('finds the file and loads the configuration', async function() {
      const identifyStub = stub(configInterface, 'identifyConfigFileFromPath').callsFake(() => './mockFile');
      const writeStub = stub(configInterface, 'writeDefault').callsFake(() => 'mockFile');
      const loadStub = stub(configInterface, 'loadConfig').callsFake(() => mockConfig);
      const logSpy = spy(loggerInterface, 'log');

      const configGenerator = new ConfigGenerator({
        options,
        config: configInterface,
        logger: loggerInterface,
        inputHandler: inquirer
      });

      await configGenerator.generate();

      assert(identifyStub.calledOnceWith(options.root), 'looked for file in the appropriate place');
      assert(logSpy.calledOnceWith(match('found -> skipping creation')),
        'informed user of appropriate action');
      assert(loadStub.calledOnceWith(options.root), 'loaded the config file');
      return assert(writeStub.notCalled, 'did not write anything to disk');
    });

    it('does not find the file, gets user input, and creates one', async function() {
      const identifyStub = stub(configInterface, 'identifyConfigFileFromPath').throws();
      const writeStub = stub(configInterface, 'writeDefault').callsFake(() => 'mockFile');
      const loadStub = stub(configInterface, 'loadConfig').callsFake(() => mockConfig);
      const logSpy = spy(loggerInterface, 'log');

      const configGenerator = new ConfigGenerator({
        options,
        config: configInterface,
        logger: loggerInterface,
        inputHandler: inquirer
      });

      await configGenerator.generate();

      assert(identifyStub.calledOnceWith(options.root), 'looked for the file');
      assert(inquirer.prompt.called, 'prompted user for input');
      assert(logSpy.calledWith(match('creating')), "informed user it's writing the file");
      assert(writeStub.calledOnceWith(options.root, options.configLanguage, name), 'wrote to disk');
      return assert(loadStub.calledOnceWith(options.root), 'loaded the config file');
    });

    it('throws when it finds the config file elsewhere than the root path', function() {
      stub(configInterface, 'identifyConfigFileFromPath').callsFake(() => 'otherDir/mockFile');

      const configGenerator = new ConfigGenerator({
        options,
        config: configInterface,
        logger: loggerInterface,
        inputHandler: inquirer
      });

      const testFn = async () => await configGenerator.generate();

      return assert.isRejected(testFn(), /[cC]onfig file found in ancestor directory/, 'throws an error');
    });

    it('prompts the user for input with a default project name', async function() {
      const dirName = 'sample';
      const rootPathStub = stub(ConfigGenerator.prototype, '_rootPath').returns(dirName);
      stub(configInterface, 'identifyConfigFileFromPath').throws();
      stub(configInterface, 'writeDefault').callsFake(() => 'mockFile');
      stub(configInterface, 'loadConfig').callsFake(() => mockConfig);

      const configGenerator = new ConfigGenerator({
        options,
        config: configInterface,
        logger: loggerInterface,
        inputHandler: inquirer
      });

      await configGenerator.generate();

      rootPathStub.restore();

      return assert(
        inquirer.prompt.calledWith(
          match({message: 'What would you like to name the project? (default: "sample")'})
        ), 'prompted the user with default project name'
      );
    });


    return it('prompts the user for input without a default project name', async function() {
      stub(configInterface, 'identifyConfigFileFromPath').throws();
      stub(configInterface, 'writeDefault').callsFake(() => 'mockFile');
      stub(configInterface, 'loadConfig').callsFake(() => mockConfig);

      const configGenerator = new ConfigGenerator({
        options,
        config: configInterface,
        logger: loggerInterface,
        inputHandler: inquirer
      });

      await configGenerator.generate();

      return assert(
        inquirer.prompt.calledWith(
          match({message: 'What would you like to name the project?'})
        ), 'prompted the user without default project name'
      );
    });
  });
});
