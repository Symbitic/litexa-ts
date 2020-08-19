/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const { spawnSync } = require('child_process');

require('@litexa/core/aliasing');
const Skill = require('@litexa/core/src/parser/skill');
const ProjectInfo = require('@litexa/core/src/command-line/project-info');
const builder = require('@litexa/core/src/command-line/skill-builder');
const { __resetLib } = require('@litexa/core/src/parser/parserlib');

class Logger {
  constructor(name) {
    this.name = name;
    this.disableColor = true;
    this.path = path.join(testRoot, this.name + '.log');
    fs.writeFileSync(this.path, "", 'utf8');
  }

  log() {
    let line = [];
    for (let a of arguments) {
      line.push("" + a);
    }
    line += '\n';
    fs.appendFileSync(this.path, line, 'utf8');
  }

  error() {
    let line = [];
    for (let a of arguments) {
      line.push("" + a);
    }
    line += '\n';
    fs.appendFileSync(this.path, line, 'utf8');
  }
};

async function runSkill(name) {
  const root = path.join(__dirname, 'data', name);

  const cleanTempDirectories = () => {
    rimraf.sync(path.join(root, '.test'));
    rimraf.sync(path.join(root, '.deploy'));
    rimraf.sync(path.join(root, '.logs'));
  };

  const cleanNPM = () => {
    rimraf.sync(path.join(root, 'node_modules'));
    rimraf.sync(path.join(root, 'litexa', 'node_modules'));
    try {
      fs.unlinkSync(path.join(root, 'package-lock.json'));
    } catch (error) { }
  };

  const installNPM = () => {
    cleanNPM();
    const installAt = (loc) => {
      if (fs.existsSync(path.join(loc, 'package.json'))) {
        try {
          fs.unlinkSync(path.join(root, 'package-lock.json'));
        } catch (error) { }
        spawnSync('npm', ['install'], {
          cwd: loc,
          shell: true
        });
      }
    };
    installAt(root);
    installAt(path.join(root, 'litexa'));
  };

  cleanTempDirectories();
  installNPM();
  const skill = await builder.build(root);
  skill.projectInfo.testRoot = path.join(skill.projectInfo.root, '.test');
  mkdirp.sync(skill.projectInfo.testRoot);

  const result = await new Promise(function (resolve, reject) {
    let l;
    try {
      skill.toLambda();
    } catch (error) {
      err = error;
      if (err.location) {
        const l = err.location;
        if (l.start && l.start.line && l.start.column) {
          err = new Error(`${l.source}[${l.start.line}:${l.start.column}] ${err.toString()}`);
        } else {
          err = new Error(`${l.source} ${err.toString()}`);
        }
      }
      return reject(err);
    }

    // Let's run our tests on a 'show', so Display, APL, and HTML are supported.
    return skill.runTests({ testDevice: 'show', logRawData: true }, (err, result) => {
      if (err != null) {
        return reject(err);
      }
      if (!result.success) {
        for (l of result.log) {
          console.error(l);
        }
        return reject(new Error(result.summary));
      }
      return resolve(result);
    });
  });
  cleanNPM();
  return result;
};

async function buildSkillModel(name, locale) {
  if (!locale) {
    locale = 'en-US';
  }
  const root = path.join(__dirname, 'data', name);

  const cleanTempDirectories = () => {
    rimraf.sync(path.join(root, '.test'));
    rimraf.sync(path.join(root, '.deploy'));
    rimraf.sync(path.join(root, '.logs'));
  };

  const cleanNPM = () => {
    rimraf.sync(path.join(root, 'node_modules'));
    rimraf.sync(path.join(root, 'litexa', 'node_modules'));
    try {
      fs.unlinkSync(path.join(root, 'package-lock.json'));
    } catch (error) {}
  };

  const installNPM = () => {
    cleanNPM();
    const installAt = (loc) => {
      if (fs.existsSync(path.join(loc, 'package.json'))) {
        try {
          fs.unlinkSync(path.join(root, 'package-lock.json'));
        } catch (error) {}
        return spawnSync('npm', ['install'], { cwd: loc, shell: true });
      }
    };
    installAt(root);
    installAt(path.join(root, 'litexa'));
  };

  cleanTempDirectories();
  installNPM();
  const skill = await builder.build(root);

  skill.projectInfo.testRoot = path.join(skill.projectInfo.root, '.test');
  mkdirp.sync(skill.projectInfo.testRoot);

  const result = await new Promise((resolve, reject) => {
    let err;
    try {
      skill.toLambda();
    } catch (error) {
      err = error;
      if (err.location) {
        const l = err.location;
        if (l.start && l.start.line && l.start.column) {
          err = new Error(`${l.source}[${l.start.line}:${l.start.column}] ${err.toString()}`);
        } else {
          err = new Error(`${l.source} ${err.toString()}`);
        }
      }
      return reject(err);
    }

    // Let's run our tests on a 'show', so Display, APL, and HTML are supported.
    try {
      return resolve(skill.toModelV2(locale));
    } catch (err) {
      return reject(`failed to build model: ${JSON.stringify(err)}`);
    }
  });

  cleanNPM();
  return result;
};

function buildSkill(lit) {
  __resetLib();

  const skill = new Skill.Skill(ProjectInfo.createMock());

  if (typeof (lit) === 'string') {
    skill.setFile("main.litexa", "default", lit + '\n');
  } else {
    for (let name in lit) {
      const contents = lit[name];
      let [ filename, language ] = name.split('_');
      language = language ? language : 'default';
      if (!(filename.indexOf('.') > 0)) {
        filename += ".litexa";
      }
      skill.setFile(filename, language, contents + '\n');
    }
  }
  return skill;
};

function expectParse(lit) {
  try {
    const skill = buildSkill(lit);
    return skill.toModelV2('en-US');
  } catch (err) {
    console.error(`failed to parse: ${JSON.stringify(lit)}`);
    throw err;
  }
};

function expectFailParse(lit, errorMessageSubstring) {
  try {
    const skill = buildSkill(lit);
    skill.toModelV2('en-US');
  } catch (err) {
    if (errorMessageSubstring) {
      if (!(err.message && err.message.includes(errorMessageSubstring))) {
        throw new Error(`Parse error message \`${err.message}\`\ndid not contain text: ${errorMessageSubstring}`);
      }
    }
    return;
  }

  throw new Error(`Parse did not throw on: \n${lit}`);
};

module.exports = {
  Logger,
  runSkill,
  buildSkillModel,
  buildSkill,
  expectParse,
  expectFailParse
};
