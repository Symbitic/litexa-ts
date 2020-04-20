/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const chokidar = require('chokidar');
const skillBuilder = require('./skill-builder');
const projectConfig = require('./project-config');

async function run(options) {
  const logger = options.logger ? options.logger : console;

  if (logger.disableColor) {
    chalk.enabled = false;
  }

  let testFailed = false;

  const error = (line, info) => {
    let stack;
    testFailed = true;
    let prefix = "";

    if (info && info.summary) {
      logger.log(chalk.red(info.summary));
    }

    if (line.location) {
      const l = line.location;
      if (l.start) {
        prefix = `${l.source}(${l.start && l.start.line},${l.start && l.start.column}): `;
      } else if (l.first_line) {
        prefix = `${line.filename}(${l.first_line+1},${l.first_column}): `;
        line = line.message;
      }
      return logger.log(chalk.red(prefix + line));
    } else if (line.name) {
      stack = line.stack.split('\n');
      if (stack[1].indexOf('Skill.runTests') >= 0) {
        return logger.log(chalk.red(`Error executing inline code. ${stack[0]}`));
      } else {
        return logger.log(chalk.red(stack.join('\n')));
      }
    } else if (line.stack) {
      logger.log(chalk.red('[unknown location]'));
      return logger.log(chalk.red(line.stack.split('\n').join('\n')));
    } else {
      logger.log(chalk.red('[unknown location]'));
      return logger.log(chalk.red(line));
    }
  };

  const important = line => logger.log(chalk.inverse(line));

  const doTest = async () => {
    let err, skill;
    let filterReport = 'no filter';
    if (options && options.filter) {
      filterReport = `filter: ${options.filter}`;
    }
    important(`${(new Date).toLocaleString()} running tests in ${options.root} with ${filterReport}`);

    try {
      skill = await skillBuilder.build(options.root, options.deployment);
    } catch (err) {
      return error(err);
    }

    skill.projectInfo.testRoot = path.join(skill.projectInfo.root, '.test', skill.projectInfo.variant);
    mkdirp.sync(skill.projectInfo.testRoot);
    const { testRoot } = skill.projectInfo;

    fs.writeFileSync(path.join(skill.projectInfo.testRoot,'project-config.json'), JSON.stringify(skill.projectInfo, null, 2), 'utf8');

    try {
      const lambda = skill.toLambda();
      fs.writeFileSync(path.join(testRoot,'lambda.js'), lambda, 'utf8');
    } catch (err) {
      return error(err);
    }

    const testOptions = {
      focusedFiles: (options.filter ? options.filter : '').split(','),
      strictMode: !!options.strict,
      region: options.region ? options.region : 'en-US',
      testDevice: options.device ? options.device : 'show',
      logRawData: options.logRawData,
      reportProgress(str) {
        return process.stdout.write(str + '\n');
      }
    };

    try {
      const model = skill.toModelV2(testOptions.region);
      fs.writeFileSync(path.join(testRoot, 'model.json'), JSON.stringify(model, null, 2), 'utf8');
    } catch (err) {
      return error(err);
    }

    return await(new Promise(function(resolve, reject) {
      try {
        return skill.runTests(testOptions, function(err, result) {
          logger.log(' ');
          fs.writeFileSync(path.join(testRoot,'libraryCode.js'), skill.libraryCode, 'utf8');
          if (err != null) {
            error(err, result);
            return resolve();
          }

          fs.writeFileSync(path.join(testRoot,'output.json'), JSON.stringify(result, null, 2), 'utf8');
          if ((result != null ? result.log : undefined) != null) {
            result.log.unshift((new Date).toLocaleString());
            fs.writeFileSync(path.join(testRoot,'output.log'), result.log.join('\n'), 'utf8');
            for (let line of Array.from(result.log)) {
              if (line.indexOf('✘') >= 0) {
                for (let s of Array.from(line.split('\n'))) {
                  if (s.indexOf('✘') >= 0) {
                    logger.log(chalk.red(s));
                  } else {
                    logger.log(s);
                  }
                }
              } else {
                logger.log(line);
              }
            }
          }

          if ((result.summary != null ? result.summary[0] : undefined) === '✔') {
            important(result.summary);
          } else {
            testFailed = true;
            if (result.summary) {
              logger.log(chalk.inverse.red(result.summary));
            } else {
              logger.log(chalk.inverse.red('failed to invoke skill'));
            }
          }

          return resolve();
        });

      } catch (error4) {
        err = error4;
        error(err);
        return resolve();
      }
    })
    );
  };

  if (options.watch) {
    let debounce = null;
    const scheduleTest = () => {
      if (debounce) {
        return;
      }
      const ping = function() {
        debounce = null;
        return await(doTest());
      };
      return debounce = setTimeout(ping, 100);
    };

    const config = await projectConfig.loadConfig(options.root);

    chokidar.watch(`${config.root}/**/*.{litexa,coffee,js,json}`, {
      ignored: [ path.join(config.root, 'node_modules') ],
      ignoreInitial: true
    })
    .on('add', path => {
      console.log(path);
      return scheduleTest();
    })
    .on('change', () => scheduleTest());

    scheduleTest();

  } else {
    await doTest();
    if (!options.dontExit) {
      if (testFailed) {
        process.exit(-1);
      } else {
        process.exit(0);
      }
    }
  }
};

module.exports = {
  run
};
