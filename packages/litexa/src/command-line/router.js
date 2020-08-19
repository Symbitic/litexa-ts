/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import program from 'commander';
import chalk from 'chalk';
import path from 'path';
import validator from './optionsValidator';
import GenerateCommandDirector from './generateCommandDirector';
import isp from './isp';
import localization from './localization';
import projectClean from './project-clean';
import printers from './printers';
import projectConfig from './project-config';
import deploy from './deploy';
import test from './test';
import generate from './generate';
import logs from './logs';
import ProjectInfo from './project-info';
import { version as packageVersion } from '../../package.json';

export async function run() {
  let root = process.cwd();

  program
    .version(packageVersion)
    .option('--no-color', 'disables print output coloring')
    .option('-r, --region [region]', 'execution region, e.g. en-US or de-DE', 'en-US')
    .option('-v, --verbose', 'verbose output');

  program
    .command('model')
    .description("compiles a project's language model and prints it to the console.")
    .option('-d --deployment [deployment]', "which deployment to run, using the name from the deployments map in the Litexa configuration file.", 'development')
    .action(cmd => {
      chalk.enabled = cmd.parent.color;
      const options = {
        root,
        type: 'model',
        deployment: cmd.deployment,
        region: cmd.parent.region
      };
      return printers.run(options);
  });

  program
    .command('handler')
    .description("compiles a project's JavaScript handler and prints it to the console.")
    .option('-d --deployment [deployment]', "which deployment to run, using the name from the deployments map in the Litexa configuration file.", 'development')
    .action(cmd => {
      chalk.enabled = cmd.parent.color;
      const options = {
        root,
        deployment: cmd.deployment,
        type: 'handler'
      };
      return printers.run(options);
  });

  program
    .command('path [directory]')
    .description("prints the location of named paths within the current project.")
    .option('-t --type [type]', "which path: root, litexa, or assets.", 'root')
    .option('-l --language [language]', "which language. Leave blank for the default language", 'default')
    .action(async (directory, cmd) => {
      const errors = validator(
        cmd,
        [
          {
            name: 'type',
            valid: [
              'root',
              'litexa',
              'assets'
            ],
            message: 'invalid "type" option. valid type options are: root, litexa, or assets.'
          }
        ]
      );

      errors.forEach(error => console.log(chalk.red(error.message)));

      directory = directory ? directory : process.cwd();
      const config = await projectConfig.identifyConfigFileFromPath(directory);
      if (config) {
        root = path.dirname(config);
        if (cmd.language === 'default') {
          switch (cmd.type) {
            case 'root':
              return console.log(root);
            case 'litexa':
              return console.log(path.join(root, 'litexa'));
            case 'assets':
              return console.log(path.join(root, 'litexa', 'assets'));
            default:
              return console.error(chalk.red(`unknown path type ${cmd.type}`));
          }
        } else {
          switch (cmd.type) {
            case 'root':
              return console.log(root);
            case 'litexa':
              return console.log(path.join(root, 'litexa', 'languages', cmd.language));
            case 'assets':
              return console.log(path.join(root, 'litexa', 'languages', cmd.language, 'assets'));
            default:
              return console.error(chalk.red(`unknown path type ${cmd.type}`));
          }
        }
      } else {
        return console.error(chalk.red(`${directory} does not appear to be in a litexa project`));
      }
  });

  program
    .command('deploy')
    .description("executes a deployment extension to push a skill project to the internet")
    .option('-d --deployment [deployment]', "which deployment to run, using the name from the deployments map in the Litexa configuration file.", 'development')
    .option('-t --type [type]', "what to deploy: all, assets, lambda, model or manifest.", 'all')
    .option('-w, --watch', "watch for file changes, then rerun deployment")
    .option('--no-cache', "disables local caching, used when the state of deployment is unknown and needs to be thoroughly verified")
    .action(async cmd => {
      const errors = validator(
        cmd,
        [
          {
            name: 'type',
            valid: [
              'all',
              'assets',
              'lambda',
              'model',
              'manifest'
            ],
            message: 'valid type options are [all, assets, lambda, model manifest].'
          }
        ]
      );

      errors.forEach(error => console.log(chalk.red(`unknown option value ${error.name} \"${cmd[error.name]}\" : ${error.message}`)));

      if (errors.length > 0) {
        process.exit(1);
      }

      chalk.enabled = cmd.parent.color;
      const options = {
        root,
        deployment: cmd.deployment,
        type: cmd.type,
        watch: cmd.watch,
        verbose: cmd.parent.verbose,
        cache: cmd.cache,
        coreVersion: packageVersion
      };
      return await deploy.run(options);
  });

  program
    .command('test [filter]')
    .description("executes a project's tests and prints the output to the console.")
    .option('-d --deployment [deployment]', "which deployment to run, using the name from the deployments map in the Litexa configuration file.", 'development')
    .option('--no-strict', 'disable strict testing')
    .option('--device [device]', 'which device to emulate (dot, echo, show)', 'show')
    .option('--log-raw-data [logRawData]', 'dumps all raw requests, responses, and DB contents in .test/output.json')
    .option('-w, --watch', "watch for file changes, then rerun tests")
    .action((filter, cmd) => {
      const errors = validator(
        cmd,
        [
          {
            name: 'device',
            valid: [
              'dot',
              'show',
              'echo'
            ],
            message: 'ignoring invalid device. valid device options are: dot, echo, show. defaulting to "show"'
          }
        ],
        true
      );

      errors.forEach((error) => {
        if (error.name === 'device') {
          cmd.type = 'show';
        }
        console.log(chalk.yellow(error.message));
      });

      chalk.enabled = cmd.parent.color;
      const options = {
        root,
        filter,
        deployment: cmd.deployment,
        strict: cmd.strict,
        region: cmd.parent.region,
        watch: cmd.watch,
        device: cmd.device,
        logRawData: cmd.logRawData
      };
      return test.run(options);
  });

  program
    .command('generate [dir]')
    .alias('init')
    .description("creates any missing required files for a litexa project.")
    .option('-c, --config-language [configLanguage]', 'language of the generated configuration file, can be javascript, json, typescript, or coffee')
    .option('-s, --source-language [sourceLanguage]', 'language of the generated source code, can be javascript, typescript, or coffee')
    .option('-b, --bundling-strategy [bundlingStrategy]', 'the structure of the code layout as it pertains to litexa, can be webpack, npm-link, or none')
    .option('-p, --project-name [projectName]', 'the name of the project (optional)')
    .option('-t, --store-title-name [storeTitleName]', 'title to use in the skill store (optional)')
    .action(async (dir, cmd) => {
      const errors = validator(
        cmd,
        [
          {
            name: 'configLanguage',
            valid: [
              'javascript',
              'json',
              'typescript',
              'coffee'
            ],
            message: 'valid config languages are [javascript, json, typescript, coffee].'
          },
          {
            name: 'sourceLanguage',
            valid: [
              'javascript',
              'typescript',
              'coffee'
            ],
            message: 'valid source languages are [javascript, typescript, coffee].'
          },
          {
            name: 'bundlingStrategy',
            valid: [
              'none',
              'npm-link',
              'webpack'
            ],
            message: 'valid bundling strategies are [none, npm-link, webpack].'
          }
        ]
      );

      errors.forEach(error => console.log(chalk.red(`unknown option value ${error.name} \"${cmd[error.name]}\" : ${error.message}`)));

      if (errors.length > 0) {
        process.exit(1);
      }

      const guided = new GenerateCommandDirector({
        targetDirectory: dir,
        selectedOptions: cmd,
        availableOptions: [
          'configLanguage',
          'sourceLanguage',
          'bundlingStrategy',
          'projectName',
          'storeTitleName'
        ]
      });

      const selections = await guided.direct();

      chalk.enabled = cmd.parent.color;
      const options = {
        root,
        dir: path.join(root, selections.dir || '.'),
        configLanguage: selections.configLanguage ? selections.configLanguage : 'javascript',
        sourceLanguage: selections.sourceLanguage ? selections.sourceLanguage : 'javascript',
        bundlingStrategy: selections.bundlingStrategy ? selections.bundlingStrategy : 'none',
        projectName: selections.projectName,
        storeTitleName: selections.storeTitleName
      };
      return generate.run(options);
  });

  program
    .command('logs')
    .description("retrieves runtime logs from a deployed skill.")
    .option('-d --deployment [deployment]', "which deployment to pull logs from, using the name from the deployments map in the Litexa configuration file.", 'development')
    .action((cmd) => {
      chalk.enabled = cmd.parent.color;
      const options = {
        root,
        deployment: cmd.deployment,
        region: cmd.parent.region
      };
      return logs.run(options);
  });

  program
    .command('info')
    .description("prints out a litexa project's information block.")
    .action(async (cmd) => {
      chalk.enabled = cmd.color;
      try {
        const config = await (projectConfig.loadConfig(root));
        const info = new ProjectInfo({jsonConfig: config});
        return console.log(JSON.stringify(info, null, 2));
      } catch (err) {
        return console.error(err);
      }
  });

  program
    .command('pull [data]')
    .description('downloads specified data from the hosted skill via SMAPI. Currently supported for: isp (downloads remote in-skill products, and ovewrites local product files)')
    .option('-d --deployment [deployment]', "which deployment target to download specified data from, using the name from the deployments map in the Litexa configuration file.", 'development')
    .option('-s --stage [stage]', "stage for which to pull skill data (either development or live)", 'development')
    .action(async (data, cmd) => {
      const options = {
        root,
        deployment: cmd.deployment,
        stage: cmd.stage,
        verbose: cmd.parent.verbose
      };

      switch (data) {
        case 'isp':
          try {
            await isp.init(options);
            return await isp.pullAndStoreRemoteProducts();
          } catch (err) {
            return console.error(chalk.red("failed to pull in-skill products"));
          }
        default:
          return console.error(chalk.red(`unknown data type '${data}'. Currently supported data: isp`));
      }
  });

  program
    .command('push [data]')
    .description('pushes specified data from local to the hosted skill via SMAPI. Currently supports: isp (uploads local in-skill product files, and overrides remote products)')
    .option('-d --deployment [deployment]', "which deployment target to push specified data to, using the name from the deployments map in the Litexa configuration file.", 'development')
    .option('-s --stage [stage]', "stage for which to push skill data (either development or live)", 'development')
    .action(async (data, cmd) => {
      const options = {
        root,
        deployment: cmd.deployment,
        stage: cmd.stage,
        verbose: cmd.parent.verbose
      };

      switch (data) {
        case 'isp':
          try {
            await isp.init(options);
            await isp.pushLocalProducts();
          } catch (err) {
            return console.error(chalk.red("failed to push in-skill products"));
          }
        default:
          return console.error(chalk.red(`unknown data type '${data}'. Currently supported data: isp`));
      }
  });

  program
    .command('reset [data]')
    .description('resets specified data from local to the hosted skill via SMAPI. Currently supports: isp (resets all in-skill products for testing)')
    .option('-d --deployment [deployment]', "which deployment target to reset specified data for, using the name from the deployments map in the Litexa configuration file.", 'development')
    .option('-s --stage [stage]', "stage for which to reset skill data (either development or live)", 'development')
    .action(async (data, cmd) => {
      const options = {
        root,
        deployment: cmd.deployment,
        stage: cmd.stage,
        verbose: cmd.parent.verbose
      };

      switch (data) {
        case 'isp':
          try {
            await isp.init(options);
            return await isp.resetRemoteProductEntitlements();
          } catch (err) {
            return console.error(chalk.red("failed to reset in-skill product entitlements"));
          }
        default:
          return console.error(chalk.red(`unknown data type '${data}'. Currently supported data: isp`));
      }
  });

  program
    .command('localize')
    .description("parses intents/utterances, and any say/reprompt speech from the default Litexa code files. Updates existing localization.json or creates new file in the Litexa project's root directory.")
    .option('--clone-from [language]', 'specify source language for a cloning operation')
    .option('--clone-to [language]', 'copy all translations from the language specified by --clone-from to this language')
    .option('--disable-sort-languages', 'disables sorting languages in localization.json alphabetically')
    .option('--disable-sort-utterances', 'disables sorting utterances in localization.json alphabetically')
    .option('--remove-orphaned-utterances', 'remove all localization utterances that are no longer in the skill')
    .option('--remove-orphaned-speech', 'remove all speech lines that are no longer in the skill')
    // @TODO: Add options to support creating translation placeholders for languages, and warn about missing translations.
    // .option '--find-missing-translations [missingLanguage]', 'check for missing strings for a specific language'
    // .option '--create-localization-excel', 'generate Excel file from contents of localization.json'
    // .option '--parse-localization-excel [file path]', 'parse translations from indicated Excel file back into localization.json'
    .action((cmd) => {
      const options = {
        root,
        cloneFrom: cmd.cloneFrom,
        cloneTo: cmd.cloneTo,
        disableSortLanguages: cmd.disableSortLanguages,
        disableSortUtterances: cmd.disableSortUtterances,
        removeOrphanedUtterances: cmd.removeOrphanedUtterances,
        removeOrphanedSpeech: cmd.removeOrphanedSpeech,
        verbose: cmd.parent.verbose
      };

      return localization.localizeSkill(options);
  });

  program.on('command:*', () => {
    console.error(`Invalid command: ${program.args.join(' ')}`);
    console.error('See --help for a list of available commands.');
    return process.exit(1);
  });

  program.on('--help', () => {
    console.log('');
    console.log('  For help on each command, pass --help to each, e.g. litexa test --help');
    return console.log('');
  });

  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }

  await projectClean.run({
    root
  });

  return program.parse(process.argv);
};
